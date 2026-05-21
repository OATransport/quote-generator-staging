import "server-only";

import { randomUUID } from "crypto";
import { Prisma, QuoteStatus, type GhlFieldMapping } from "@prisma/client";
import { parseMakeModel, resolveImportLocationFields, resolveKeenerCombinedLocation } from "@/lib/address-parse";
import { quoteResultFields } from "@/lib/ghl-field-mapping-config";
import {
  knownGhlFieldRefForLocation,
  stripContactPrefix,
} from "@/lib/ghl-known-field-ids";
import {
  ghlLocationIdForAccountKey,
  resolveGhlImportAccountKey,
} from "@/lib/ghl-accounts";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/utils";
import {
  ensureImportMappings,
  getGhlFieldMappingsForLocation,
  ghlFieldMappingWhere,
  getActiveGhlLocationId,
  KEENER_GHL_LOCATION_ID,
  mockCompanyToGhlLocationId,
  resolveCompanyAndQuoteModeForGhlLocation,
  resolveOpportunityGhlLocationId,
} from "@/lib/ghl-field-mappings";
import {
  getActiveGhlCredentials,
  getGhlCredentialsForLocation,
  hasAnyGhlCredentials,
  type GhlAccountCredentials,
} from "@/server/ghl-credentials";
import { getMockGhlContact, getMockGhlOpportunity, searchMockGhlOpportunities } from "@/server/ghl-mock";

export function isMockGhlMode() {
  return !hasAnyGhlCredentials();
}

export function isGhlSyncBackEnabled() {
  return process.env.GHL_SYNC_BACK_ENABLED?.trim().toLowerCase() === "true";
}

export function isGhlAutoSyncBackEnabled() {
  return process.env.GHL_AUTO_SYNC_BACK_ENABLED?.trim().toLowerCase() === "true";
}

export type GhlOpportunityCustomFieldUpdate = {
  id: string;
  field_value: string;
};

export const ACTIVE_QUOTE_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "IMPORTED_FROM_GHL",
  "READY_TO_SEND",
  "PDF_GENERATED",
  "SYNCED_TO_GHL",
  "SENT",
  "VIEWED",
  "CONVERTED",
];

type GhlCustomField = {
  id?: string;
  key?: string;
  name?: string;
  fieldKey?: string;
  field_value?: unknown;
  fieldValue?: unknown;
  value?: unknown;
};

export type GhlCustomFieldOption = {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
  model?: string;
};

type GhlContact = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  customFields?: GhlCustomField[];
  [key: string]: unknown;
};

type GhlOpportunity = {
  id: string;
  name?: string;
  contactId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  stageId?: string;
  status?: string;
  monetaryValue?: number;
  createdAt?: string;
  updatedAt?: string;
  dateAdded?: string;
  dateUpdated?: string;
  customFields?: GhlCustomField[];
  contact?: GhlContact;
  [key: string]: unknown;
};

export type GhlPipelineOpportunitySearchResult = {
  id: string;
  name: string;
  contactId?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  pipelineId?: string;
  stageId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ImportPayload = {
  opportunity: GhlOpportunity;
  contact?: GhlContact;
  mappings: GhlFieldMapping[];
};

function ghlBaseUrl() {
  return (process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
}

async function ghlFetch<T>(path: string, init?: RequestInit, credentials?: GhlAccountCredentials): Promise<T> {
  const creds = credentials ?? getActiveGhlCredentials();
  const response = await fetch(`${ghlBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.privateIntegrationToken}`,
      Version: process.env.GHL_API_VERSION ?? "2021-07-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GHL request failed ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

function asString(value: unknown) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

function asDecimal(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : new Prisma.Decimal(fallback);
}

function asDate(value: unknown) {
  const text = asString(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asIsoDate(value: unknown) {
  const date = asDate(value);
  return date?.toISOString();
}

function getPath(source: unknown, path?: string | null): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

function readCustomFieldEntryValue(field: GhlCustomField) {
  return field.field_value ?? field.fieldValue ?? field.value;
}

function normalizeCustomFieldEntries(fields: unknown): GhlCustomField[] {
  if (!fields) return [];
  if (Array.isArray(fields)) return fields as GhlCustomField[];
  if (typeof fields === "object") {
    return Object.entries(fields as Record<string, unknown>).map(([id, value]) => ({
      id,
      field_value: value,
      value,
    }));
  }
  return [];
}

function customFieldValue(fields: unknown, mapping: GhlFieldMapping) {
  const normalized = normalizeCustomFieldEntries(fields);
  const fieldKeyCandidates = new Set(
    [mapping.ghlCustomFieldName, mapping.fallbackPath, stripContactPrefix(mapping.fallbackPath ?? "")]
      .filter(Boolean)
      .flatMap((value) => [value, stripContactPrefix(value!)]),
  );

  const match = normalized.find((field) => {
    const keys = [field.fieldKey, field.key, field.name].filter(Boolean);
    return (
      (mapping.ghlCustomFieldId && field.id === mapping.ghlCustomFieldId) ||
      (mapping.ghlCustomFieldName && keys.some((key) => key === mapping.ghlCustomFieldName)) ||
      keys.some((key) => fieldKeyCandidates.has(key ?? ""))
    );
  });

  if (match) return readCustomFieldEntryValue(match);

  if (mapping.ghlCustomFieldId && fields && typeof fields === "object" && !Array.isArray(fields)) {
    const direct = (fields as Record<string, unknown>)[mapping.ghlCustomFieldId];
    if (direct != null) return direct;
  }

  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    const objectFields = fields as Record<string, unknown>;
    for (const candidate of fieldKeyCandidates) {
      if (candidate && objectFields[candidate] != null) return objectFields[candidate];
    }
  }

  return undefined;
}

function readValueByFieldKey(payload: ImportPayload, fieldKey: string): unknown {
  const normalizedKey = stripContactPrefix(fieldKey);
  const candidates = new Set([fieldKey, normalizedKey]);

  for (const fields of [payload.contact?.customFields, payload.opportunity.customFields]) {
    const normalized = normalizeCustomFieldEntries(fields);
    const match = normalized.find((field) => {
      const keys = [field.fieldKey, field.key, field.name, field.id].filter(Boolean);
      return keys.some((key) => candidates.has(key ?? ""));
    });
    if (match) return readCustomFieldEntryValue(match);

    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
      const objectFields = fields as Record<string, unknown>;
      for (const candidate of candidates) {
        if (objectFields[candidate] != null) return objectFields[candidate];
      }
    }
  }

  if (payload.contact) {
    const fromContact = getPath(payload.contact, normalizedKey);
    if (fromContact != null) return fromContact;
    const fromNested = getPath(payload.contact, `customFields.${normalizedKey}`);
    if (fromNested != null) return fromNested;
  }

  const fromOpportunity = getPath(payload.opportunity, normalizedKey);
  if (fromOpportunity != null) return fromOpportunity;

  return undefined;
}

function mappedValue(payload: ImportPayload, appFieldKey: string) {
  const ghlLocationId = resolveOpportunityGhlLocationId(payload.opportunity);
  const mapping = payload.mappings.find((item) => item.appFieldKey === appFieldKey);
  const known = knownGhlFieldRefForLocation(ghlLocationId, appFieldKey);

  if (mapping) {
    const fromMapping =
      customFieldValue(payload.opportunity.customFields, mapping) ??
      customFieldValue(payload.contact?.customFields, mapping) ??
      (mapping.fallbackPath ? readValueByFieldKey(payload, mapping.fallbackPath) : undefined) ??
      getPath(payload.opportunity, mapping.fallbackPath) ??
      getPath(payload.contact, mapping.fallbackPath);
    if (fromMapping != null && fromMapping !== "") return fromMapping;
  }

  if (known?.ghlFieldKey) {
    const fromKnown = readValueByFieldKey(payload, known.ghlFieldKey);
    if (fromKnown != null && fromKnown !== "") return fromKnown;
  }

  return undefined;
}

function mappedText(payload: ImportPayload, appFieldKey: string) {
  return asString(mappedValue(payload, appFieldKey));
}

function contactName(contact?: GhlContact, opportunity?: GhlOpportunity) {
  const fullName = [asString(contact?.firstName), asString(contact?.lastName)].filter(Boolean).join(" ");
  return (
    asString(contact?.name) ??
    asString(fullName) ??
    asString(opportunity?.name) ??
    "Unknown customer"
  );
}

function normalizeOpportunity(data: unknown): GhlOpportunity {
  const object = data as Record<string, unknown>;
  return (object.opportunity ?? object) as GhlOpportunity;
}

function normalizeContact(data: unknown): GhlContact {
  const object = data as Record<string, unknown>;
  return (object.contact ?? object) as GhlContact;
}

function normalizeOpportunityList(data: unknown): GhlOpportunity[] {
  const object = data as Record<string, unknown>;
  return ((object.opportunities ?? object.items ?? object.data ?? []) as GhlOpportunity[]).filter(Boolean);
}

function normalizeCustomFields(data: unknown): GhlCustomFieldOption[] {
  const object = data as Record<string, unknown>;
  const fields = (object.customFields ?? object.fields ?? object.data ?? []) as Array<Record<string, unknown>>;
  return fields
    .map((field) => ({
      id: asString(field.id) ?? "",
      name: asString(field.name) ?? asString(field.fieldKey) ?? "Untitled field",
      fieldKey: asString(field.fieldKey) ?? asString(field.key),
      dataType: asString(field.dataType),
      model: asString(field.model),
    }))
    .filter((field) => field.id);
}

function normalizeCustomField(data: unknown): GhlCustomFieldOption | undefined {
  const object = data as Record<string, unknown>;
  const field = (object.customField ?? object) as Record<string, unknown>;
  const id = asString(field.id);
  if (!id) return undefined;
  return {
    id,
    name: asString(field.name) ?? asString(field.fieldKey) ?? "Untitled field",
    fieldKey: asString(field.fieldKey) ?? asString(field.key),
    dataType: asString(field.dataType),
    model: asString(field.model),
  };
}

function isLikelyId(query: string) {
  return /^[a-zA-Z0-9_-]{8,}$/.test(query.trim());
}

function searchMatches(opportunity: GhlOpportunity, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    opportunity.id,
    opportunity.name,
    opportunity.contactId,
    opportunity.contact?.name,
    opportunity.contact?.email,
    opportunity.contact?.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function toSearchResult(opportunity: GhlOpportunity): GhlPipelineOpportunitySearchResult {
  return {
    id: opportunity.id,
    name: asString(opportunity.name) ?? "Untitled opportunity",
    contactId: opportunity.contactId,
    customerName: contactName(opportunity.contact, opportunity),
    email: asString(opportunity.contact?.email),
    phone: asString(opportunity.contact?.phone),
    pipelineId: opportunity.pipelineId,
    stageId: opportunity.pipelineStageId ?? opportunity.stageId,
    createdAt: asIsoDate(opportunity.createdAt ?? opportunity.dateAdded),
    updatedAt: asIsoDate(opportunity.updatedAt ?? opportunity.dateUpdated),
  };
}

async function createSyncLog(data: {
  quoteId?: string;
  direction?: "GHL_TO_APP" | "APP_TO_GHL";
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  requestPayload: Prisma.InputJsonValue;
  responsePayload?: Prisma.InputJsonValue;
  errorMessage?: string;
}) {
  await prisma.ghlSyncLog.create({
    data: {
      quoteId: data.quoteId,
      direction: data.direction ?? "GHL_TO_APP",
      status: data.status,
      requestPayload: data.requestPayload,
      responsePayload: data.responsePayload,
      errorMessage: data.errorMessage,
    },
  });
}

export async function searchGhlPipelineOpportunities(
  query: string,
  options?: { stageId?: string; ghlLocationId?: string; account?: string },
) {
  const accountKey = resolveGhlImportAccountKey(options?.account);
  const ghlLocationId = options?.ghlLocationId ?? ghlLocationIdForAccountKey(accountKey);

  if (isMockGhlMode()) {
    return searchMockGhlOpportunities(query, { stageId: options?.stageId, ghlLocationId }).map((entry) =>
      toSearchResult(entry.opportunity),
    );
  }

  const credentials = getGhlCredentialsForLocation(ghlLocationId);
  const trimmed = query.trim();
  const params = new URLSearchParams({
    location_id: credentials.ghlLocationId,
    pipeline_id: credentials.quotePipelineId,
  });

  const results = new Map<string, GhlOpportunity>();

  const searchData = await ghlFetch<unknown>(`/opportunities/search?${params.toString()}`, undefined, credentials);
  for (const opportunity of normalizeOpportunityList(searchData)) {
    if (opportunity.pipelineId === credentials.quotePipelineId && searchMatches(opportunity, trimmed)) {
      results.set(opportunity.id, opportunity);
    }
  }

  if (trimmed && isLikelyId(trimmed)) {
    try {
      const opportunity = await getGhlOpportunity(trimmed, credentials.ghlLocationId);
      if (opportunity.pipelineId === credentials.quotePipelineId) results.set(opportunity.id, opportunity);
    } catch {
      // A typed search may look like an ID without actually being one.
    }
  }

  const opportunities = Array.from(results.values()).filter((opportunity) => {
    const stageId = opportunity.pipelineStageId ?? opportunity.stageId;
    return !options?.stageId || stageId === options.stageId;
  });

  const enriched = await Promise.all(
    opportunities.map(async (opportunity) => {
      if (opportunity.contact || !opportunity.contactId) return opportunity;
      try {
        return {
          ...opportunity,
          contact: await getGhlContact(opportunity.contactId, credentials.ghlLocationId),
        };
      } catch {
        return opportunity;
      }
    }),
  );

  return enriched.map(toSearchResult);
}

export async function getGhlOpportunity(opportunityId: string, ghlLocationId?: string) {
  if (isMockGhlMode()) {
    const mock = getMockGhlOpportunity(opportunityId);
    if (!mock) throw new Error(`Mock opportunity not found: ${opportunityId}`);
    return mock.opportunity;
  }

  const credentials = getGhlCredentialsForLocation(
    ghlLocationId ?? getActiveGhlCredentials().ghlLocationId,
  );
  const data = await ghlFetch<unknown>(
    `/opportunities/${encodeURIComponent(opportunityId)}`,
    undefined,
    credentials,
  );
  return normalizeOpportunity(data);
}

export async function getGhlContact(contactId: string, ghlLocationId?: string) {
  if (isMockGhlMode()) {
    const contact = getMockGhlContact(contactId);
    if (!contact) throw new Error(`Mock contact not found: ${contactId}`);
    return contact;
  }

  const credentials = getGhlCredentialsForLocation(
    ghlLocationId ?? getActiveGhlCredentials().ghlLocationId,
  );
  const data = await ghlFetch<unknown>(`/contacts/${encodeURIComponent(contactId)}`, undefined, credentials);
  return normalizeContact(data);
}

export async function getGhlCustomFields(ghlLocationId?: string) {
  if (isMockGhlMode()) {
    return [];
  }

  const credentials = getGhlCredentialsForLocation(
    ghlLocationId ?? getActiveGhlCredentials().ghlLocationId,
  );
  const data = await ghlFetch<unknown>(
    `/locations/${encodeURIComponent(credentials.ghlLocationId)}/customFields`,
    undefined,
    credentials,
  );
  return normalizeCustomFields(data);
}

export async function updateGhlOpportunityCustomFields(
  opportunityId: string,
  customFields: GhlOpportunityCustomFieldUpdate[],
  ghlLocationId: string,
) {
  if (isMockGhlMode()) {
    throw new Error("Cannot update GHL opportunity in mock mode.");
  }
  if (!customFields.length) {
    throw new Error("At least one custom field is required to update a GoHighLevel opportunity.");
  }

  const credentials = getGhlCredentialsForLocation(ghlLocationId);
  const data = await ghlFetch<unknown>(
    `/opportunities/${encodeURIComponent(opportunityId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ customFields }),
    },
    credentials,
  );
  return data;
}

async function createGhlCustomField(input: { name: string; dataType: string }, ghlLocationId: string) {
  const credentials = getGhlCredentialsForLocation(ghlLocationId);
  const data = await ghlFetch<unknown>(
    `/locations/${encodeURIComponent(credentials.ghlLocationId)}/customFields`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        dataType: input.dataType,
        model: "opportunity",
      }),
    },
    credentials,
  );
  return normalizeCustomField(data);
}

export async function createMissingQuoteResultFields() {
  const ghlLocationId = getActiveGhlLocationId();
  const existingFields = await getGhlCustomFields(ghlLocationId);
  const existingMappings = await prisma.ghlFieldMapping.findMany({
    where: {
      ghlLocationId,
      appFieldKey: { in: quoteResultFields.map((field) => field.key) },
    },
  });
  const mappingByKey = new Map(existingMappings.map((mapping) => [mapping.appFieldKey, mapping]));
  const existingFieldsByName = new Map(existingFields.map((field) => [field.name.toLowerCase(), field]));
  const existingFieldsByKey = new Map(
    existingFields
      .map((field) => (field.fieldKey ? [field.fieldKey.toLowerCase(), field] as const : undefined))
      .filter((field): field is readonly [string, GhlCustomFieldOption] => Boolean(field)),
  );
  const created: Array<{ appFieldKey: string; field: GhlCustomFieldOption }> = [];
  const mappedExisting: Array<{ appFieldKey: string; field: GhlCustomFieldOption }> = [];
  const skipped: Array<{ appFieldKey: string; reason: string }> = [];
  const failed: Array<{ appFieldKey: string; error: string }> = [];

  for (const field of quoteResultFields) {
    const existingMapping = mappingByKey.get(field.key);
    const requestPayload = jsonValue({
      action: "CREATE_MISSING_QUOTE_RESULT_FIELD",
      appFieldKey: field.key,
      name: field.label,
      dataType: field.createDataType ?? "TEXT",
      model: "opportunity",
    });

    if (existingMapping?.ghlCustomFieldId) {
      skipped.push({ appFieldKey: field.key, reason: "Mapping already exists; not overwritten." });
      await createSyncLog({
        direction: "APP_TO_GHL",
        status: "SKIPPED",
        requestPayload,
        responsePayload: jsonValue({ reason: "Mapping already exists; not overwritten.", mappingId: existingMapping.id }),
      });
      continue;
    }

    const expectedName = field.label;
    const expectedKey = field.key.toLowerCase();
    const matchingExistingField = existingFieldsByName.get(expectedName.toLowerCase()) ?? existingFieldsByKey.get(expectedKey);

    if (matchingExistingField) {
      await prisma.ghlFieldMapping.upsert({
        where: ghlFieldMappingWhere(ghlLocationId, field.key),
        update: {
          ghlCustomFieldId: matchingExistingField.id,
          ghlCustomFieldName: matchingExistingField.name,
        },
        create: {
          ghlLocationId,
          appFieldKey: field.key,
          ghlCustomFieldId: matchingExistingField.id,
          ghlCustomFieldName: matchingExistingField.name,
          isRequired: Boolean(field.critical),
        },
      });
      mappedExisting.push({ appFieldKey: field.key, field: matchingExistingField });
      await createSyncLog({
        direction: "APP_TO_GHL",
        status: "SKIPPED",
        requestPayload,
        responsePayload: jsonValue({
          reason: "Matching GHL field already exists; saved mapping without creating a duplicate.",
          field: matchingExistingField,
        }),
      });
      continue;
    }

    try {
      const createdField = await createGhlCustomField(
        {
          name: expectedName,
          dataType: field.createDataType ?? "TEXT",
        },
        ghlLocationId,
      );
      if (!createdField) throw new Error("GHL did not return the created custom field.");

      await prisma.ghlFieldMapping.upsert({
        where: ghlFieldMappingWhere(ghlLocationId, field.key),
        update: {
          ghlCustomFieldId: createdField.id,
          ghlCustomFieldName: createdField.name,
        },
        create: {
          ghlLocationId,
          appFieldKey: field.key,
          ghlCustomFieldId: createdField.id,
          ghlCustomFieldName: createdField.name,
          isRequired: Boolean(field.critical),
        },
      });
      created.push({ appFieldKey: field.key, field: createdField });
      await createSyncLog({
        direction: "APP_TO_GHL",
        status: "SUCCESS",
        requestPayload,
        responsePayload: jsonValue({ field: createdField }),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown GHL field creation error.";
      failed.push({ appFieldKey: field.key, error: errorMessage });
      await createSyncLog({
        direction: "APP_TO_GHL",
        status: "FAILED",
        requestPayload,
        errorMessage,
      });
    }
  }

  return { created, mappedExisting, skipped, failed };
}

async function getImportPayload(opportunityId: string, ghlLocationIdHint?: string | null): Promise<ImportPayload> {
  if (isMockGhlMode()) {
    const mock = getMockGhlOpportunity(opportunityId);
    if (!mock) throw new Error(`Mock opportunity not found: ${opportunityId}`);
    const ghlLocationId = mockCompanyToGhlLocationId(mock.companyId);
    const mappings = ensureImportMappings(await getGhlFieldMappingsForLocation(ghlLocationId), ghlLocationId);
    return {
      opportunity: mock.opportunity,
      contact: mock.opportunity.contact,
      mappings,
    };
  }

  const initialLocationId = ghlLocationIdHint?.trim() || getActiveGhlCredentials().ghlLocationId;
  const opportunity = await getGhlOpportunity(opportunityId, initialLocationId);
  const ghlLocationId = resolveOpportunityGhlLocationId(opportunity);
  const contactId = opportunity.contactId ?? opportunity.contact?.id;
  const [contact, dbMappings] = await Promise.all([
    contactId ? getGhlContact(contactId, ghlLocationId) : Promise.resolve(opportunity.contact),
    getGhlFieldMappingsForLocation(ghlLocationId),
  ]);
  const mappings = ensureImportMappings(dbMappings, ghlLocationId);
  return { opportunity, contact, mappings };
}

async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.quote.count({
    where: { createdAt: { gte: new Date(year, 0, 1) } },
  });
  return `Q-${year}-${String(count + 1).padStart(5, "0")}`;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function buildQuoteData(payload: ImportPayload) {
  const opportunity = payload.opportunity;
  const contact = payload.contact;
  const ghlLocationId = resolveOpportunityGhlLocationId(opportunity);
  const isKeener = ghlLocationId === KEENER_GHL_LOCATION_ID;
  const credentials = isMockGhlMode() ? null : getGhlCredentialsForLocation(ghlLocationId);
  const ghlContactId = opportunity.contactId ?? contact?.id;
  const ghlPipelineId = opportunity.pipelineId ?? credentials?.quotePipelineId;
  const ghlStageId = opportunity.pipelineStageId ?? opportunity.stageId ?? credentials?.defaultStageId;
  const customerTotal = asDecimal(mappedValue(payload, "customerTotal") ?? opportunity.monetaryValue);
  const depositDue = asDecimal(mappedValue(payload, "depositDue"));
  const balanceDue = asDecimal(mappedValue(payload, "balanceDue"), Number(customerTotal) - Number(depositDue));

  const pickup = isKeener
    ? resolveKeenerCombinedLocation(mappedText(payload, "pickupAddress"))
    : resolveImportLocationFields({
        address: mappedText(payload, "pickupAddress"),
        city: mappedText(payload, "pickupCity"),
        state: mappedText(payload, "pickupState"),
        zip: mappedText(payload, "pickupZip"),
      });
  const delivery = isKeener
    ? resolveKeenerCombinedLocation(mappedText(payload, "deliveryAddress"))
    : resolveImportLocationFields({
        address: mappedText(payload, "deliveryAddress"),
        city: mappedText(payload, "deliveryCity"),
        state: mappedText(payload, "deliveryState"),
        zip: mappedText(payload, "deliveryZip"),
      });

  const vehicleMakeText = mappedText(payload, "vehicleMake");
  const vehicleModelText = mappedText(payload, "vehicleModel");
  const parsedMakeModel = parseMakeModel(vehicleMakeText ?? vehicleModelText);

  return {
    ghlContactId,
    ghlPipelineId,
    ghlStageId,
    ghlLocationId: resolveOpportunityGhlLocationId(opportunity),
    customer: {
      ghlContactId,
      ghlOpportunityId: opportunity.id,
      name: mappedText(payload, "customerName") ?? contactName(contact, opportunity),
      phone: mappedText(payload, "customerPhone") ?? asString(contact?.phone),
      email: mappedText(payload, "customerEmail") ?? asString(contact?.email),
      companyName: mappedText(payload, "customerCompanyName") ?? asString(contact?.companyName),
      rawGhlData: jsonValue({ contact, opportunity }),
    },
    quote: {
      pickupAddress: pickup.address ?? null,
      pickupCity: pickup.city ?? null,
      pickupState: pickup.state ?? null,
      pickupZip: pickup.zip ?? null,
      pickupContactName: mappedText(payload, "pickupContactName"),
      pickupContactPhone: mappedText(payload, "pickupContactPhone"),
      pickupDate: asDate(mappedValue(payload, "pickupDate")),
      deliveryAddress: delivery.address ?? null,
      deliveryCity: delivery.city ?? null,
      deliveryState: delivery.state ?? null,
      deliveryZip: delivery.zip ?? null,
      deliveryContactName: mappedText(payload, "deliveryContactName"),
      deliveryContactPhone: mappedText(payload, "deliveryContactPhone"),
      deliveryWindow: mappedText(payload, "deliveryWindow"),
      trailerType: mappedText(payload, "trailerType"),
      customerTotal,
      depositDue,
      balanceDue,
      internalEstimatedCarrierPay: asDecimal(mappedValue(payload, "internalEstimatedCarrierPay")),
      customerNotes: mappedText(payload, "customerNotes"),
      internalNotes: mappedText(payload, "internalNotes"),
    },
    vehicle: {
      year: mappedText(payload, "vehicleYear"),
      make: vehicleMakeText ?? parsedMakeModel.make ?? null,
      model: vehicleModelText ?? parsedMakeModel.model ?? null,
      type: mappedText(payload, "vehicleType"),
      condition: mappedText(payload, "vehicleCondition"),
      vin: mappedText(payload, "vehicleVin"),
      isRunning: ["true", "yes", "running", "1"].includes(String(mappedValue(payload, "vehicleIsRunning")).toLowerCase()),
      notes: mappedText(payload, "vehicleNotes"),
      rawVehicleData: jsonValue({
        year: mappedValue(payload, "vehicleYear"),
        make: mappedValue(payload, "vehicleMake"),
        model: mappedValue(payload, "vehicleModel"),
        type: mappedValue(payload, "vehicleType"),
        condition: mappedValue(payload, "vehicleCondition"),
        vin: mappedValue(payload, "vehicleVin"),
      }),
    },
  };
}

export async function importGhlOpportunityToQuote(
  opportunityId: string,
  options?: { ghlLocationId?: string; account?: string },
) {
  const accountKey = resolveGhlImportAccountKey(options?.account);
  const ghlLocationIdHint = options?.ghlLocationId ?? ghlLocationIdForAccountKey(accountKey);
  const requestPayload = jsonValue({ opportunityId, account: accountKey, ghlLocationId: ghlLocationIdHint });
  let quoteId: string | undefined;

  try {
    const activeQuote = await prisma.quote.findFirst({
      where: {
        ghlOpportunityId: opportunityId,
        status: { in: ACTIVE_QUOTE_STATUSES },
      },
    });

    if (activeQuote) {
      await createSyncLog({
        quoteId: activeQuote.id,
        status: "SKIPPED",
        requestPayload,
        responsePayload: jsonValue({ reason: "Active quote already exists.", quoteId: activeQuote.id }),
      });
      return activeQuote;
    }

    const payload = await getImportPayload(opportunityId, ghlLocationIdHint);
    const mapped = buildQuoteData(payload);
    const mockMeta = isMockGhlMode() ? getMockGhlOpportunity(opportunityId) : undefined;
    const locationDefaults = resolveCompanyAndQuoteModeForGhlLocation(mapped.ghlLocationId);
    const companyId = mockMeta?.companyId ?? locationDefaults.companyId;
    const quoteMode = mockMeta?.quoteMode ?? locationDefaults.quoteMode;
    const quoteNumber = await nextQuoteNumber();
    const secureAccessToken = randomUUID();
    const acceptanceUrl = appUrl(`/accept/${secureAccessToken}`);
    const importMessage = isMockGhlMode()
      ? "Imported from mock GoHighLevel pipeline lead (local testing)."
      : "Imported from existing GoHighLevel pipeline lead.";

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        quoteMode,
        status: "IMPORTED_FROM_GHL",
        secureAccessToken,
        acceptanceUrl,
        ghlContactId: mapped.ghlContactId,
        ghlOpportunityId: payload.opportunity.id,
        ghlLocationId: mapped.ghlLocationId,
        ghlPipelineId: mapped.ghlPipelineId,
        ghlStageId: mapped.ghlStageId,
        ...mapped.quote,
        company: { connect: { id: companyId } },
        customerSnapshot: { create: mapped.customer },
        vehicles: { create: mapped.vehicle },
        events: {
          create: {
            type: isMockGhlMode() ? "IMPORTED_FROM_MOCK_GHL" : "IMPORTED_FROM_GHL",
            message: importMessage,
            metadata: jsonValue({
              opportunityId: payload.opportunity.id,
              contactId: mapped.ghlContactId,
              mockMode: isMockGhlMode(),
            }),
          },
        },
      },
    });
    quoteId = quote.id;

    await createSyncLog({
      quoteId,
      status: isMockGhlMode() ? "SKIPPED" : "SUCCESS",
      requestPayload,
      responsePayload: jsonValue({
        quoteId,
        quoteNumber,
        opportunityId: payload.opportunity.id,
        mockMode: isMockGhlMode(),
        reason: isMockGhlMode() ? "Mock GHL mode — no API call made." : undefined,
      }),
    });

    return quote;
  } catch (error) {
    await createSyncLog({
      quoteId,
      status: "FAILED",
      requestPayload,
      errorMessage: error instanceof Error ? error.message : "Unknown GHL import error.",
    });
    throw error;
  }
}

export async function refreshQuoteFromGhl(quoteId: string) {
  const existingQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
  if (!existingQuote.ghlOpportunityId) {
    throw new Error("Quote is not linked to a GoHighLevel opportunity.");
  }

  const payload = await getImportPayload(existingQuote.ghlOpportunityId, existingQuote.ghlLocationId);
  const mapped = buildQuoteData(payload);
  const mockMeta = isMockGhlMode() ? getMockGhlOpportunity(existingQuote.ghlOpportunityId) : undefined;
  const locationDefaults = resolveCompanyAndQuoteModeForGhlLocation(mapped.ghlLocationId);
  const companyId = mockMeta?.companyId ?? locationDefaults.companyId;
  const quoteMode = mockMeta?.quoteMode ?? locationDefaults.quoteMode;

  const refreshed = await prisma.quote.update({
    where: { id: quoteId },
    data: {
      ghlContactId: mapped.ghlContactId,
      ghlLocationId: mapped.ghlLocationId,
      ghlPipelineId: mapped.ghlPipelineId,
      ghlStageId: mapped.ghlStageId,
      quoteMode,
      company: { connect: { id: companyId } },
      ...mapped.quote,
      customerSnapshot: {
        update: mapped.customer,
      },
      vehicles: {
        deleteMany: {},
        create: mapped.vehicle,
      },
      events: {
        create: {
          type: "REFRESHED_FROM_GHL",
          message: "Refreshed quote snapshot from existing GoHighLevel pipeline lead.",
          metadata: jsonValue({ opportunityId: payload.opportunity.id, contactId: mapped.ghlContactId }),
        },
      },
    },
  });

  await createSyncLog({
    quoteId,
    status: "SUCCESS",
    requestPayload: jsonValue({ quoteId, opportunityId: existingQuote.ghlOpportunityId }),
    responsePayload: jsonValue({ quoteId, opportunityId: existingQuote.ghlOpportunityId }),
  });

  return refreshed;
}
