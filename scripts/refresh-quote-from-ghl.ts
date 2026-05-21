/**
 * Refresh a quote snapshot from GHL (read-only GHL + local DB update only).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { Prisma, PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient();
const quoteNumber = process.argv[2] ?? "Q-2026-00003";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

type GhlFieldMapping = {
  appFieldKey: string;
  ghlCustomFieldId: string | null;
  ghlCustomFieldName: string | null;
  fallbackPath: string | null;
};

type GhlCustomField = { id?: string; name?: string; key?: string; fieldKey?: string; field_value?: unknown; value?: unknown };

async function ghlRead<T>(path: string): Promise<T> {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN!.trim();
  const baseUrl = (process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: process.env.GHL_API_VERSION ?? "2021-07-28",
      Accept: "application/json",
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL read failed ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

function asString(value: unknown) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

function asDate(value: unknown) {
  const text = asString(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getPath(source: unknown, path?: string | null): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) return (acc as Record<string, unknown>)[part];
    return undefined;
  }, source);
}

function customFieldValue(fields: GhlCustomField[] | undefined, mapping: GhlFieldMapping) {
  const match = fields?.find((field) => {
    return (
      (mapping.ghlCustomFieldId && field.id === mapping.ghlCustomFieldId) ||
      (mapping.ghlCustomFieldName && field.name === mapping.ghlCustomFieldName) ||
      (mapping.ghlCustomFieldName && field.key === mapping.ghlCustomFieldName) ||
      (mapping.ghlCustomFieldName && field.fieldKey === mapping.ghlCustomFieldName)
    );
  });
  return match?.field_value ?? match?.value;
}

function mappedValue(
  opportunity: Record<string, unknown>,
  contact: Record<string, unknown> | undefined,
  mappings: GhlFieldMapping[],
  appFieldKey: string,
) {
  const mapping = mappings.find((item) => item.appFieldKey === appFieldKey);
  if (!mapping) return undefined;
  const oppFields = opportunity.customFields as GhlCustomField[] | undefined;
  const contactFields = contact?.customFields as GhlCustomField[] | undefined;
  return (
    customFieldValue(oppFields, mapping) ??
    customFieldValue(contactFields, mapping) ??
    getPath(opportunity, mapping.fallbackPath) ??
    getPath(contact, mapping.fallbackPath)
  );
}

function mappedText(
  opportunity: Record<string, unknown>,
  contact: Record<string, unknown> | undefined,
  mappings: GhlFieldMapping[],
  appFieldKey: string,
) {
  return asString(mappedValue(opportunity, contact, mappings, appFieldKey));
}

function contactName(contact?: Record<string, unknown>, opportunity?: Record<string, unknown>) {
  const fullName = [asString(contact?.firstName), asString(contact?.lastName)].filter(Boolean).join(" ");
  return asString(contact?.name) ?? asString(fullName) ?? asString(opportunity?.name) ?? "Unknown customer";
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

async function main() {
  const quote = await prisma.quote.findUnique({
    where: { quoteNumber },
    include: { vehicles: true },
  });
  if (!quote?.ghlOpportunityId) throw new Error(`Quote ${quoteNumber} not found or not linked to GHL.`);

  const appToGhlBefore = await prisma.ghlSyncLog.count({
    where: { quoteId: quote.id, direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const oppData = await ghlRead<Record<string, unknown>>(`/opportunities/${encodeURIComponent(quote.ghlOpportunityId)}`);
  const opportunity = (oppData.opportunity ?? oppData) as Record<string, unknown>;
  const contactId = asString(opportunity.contactId);
  const contactData = contactId ? await ghlRead<Record<string, unknown>>(`/contacts/${encodeURIComponent(contactId)}`) : undefined;
  const contact = (contactData?.contact ?? contactData) as Record<string, unknown> | undefined;
  const mappings = quote.ghlLocationId
    ? await prisma.ghlFieldMapping.findMany({ where: { ghlLocationId: quote.ghlLocationId } })
    : await prisma.ghlFieldMapping.findMany();

  const customerTotal = mappedValue(opportunity, contact, mappings, "customerTotal") ?? opportunity.monetaryValue ?? 0;
  const depositDue = mappedValue(opportunity, contact, mappings, "depositDue") ?? 0;
  const balanceDue =
    mappedValue(opportunity, contact, mappings, "balanceDue") ?? Number(customerTotal) - Number(depositDue);

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      ghlContactId: contactId ?? quote.ghlContactId,
      ghlLocationId: asString(opportunity.locationId) ?? quote.ghlLocationId,
      ghlPipelineId: asString(opportunity.pipelineId) ?? quote.ghlPipelineId,
      ghlStageId: asString(opportunity.pipelineStageId ?? opportunity.stageId) ?? quote.ghlStageId,
      pickupAddress: mappedText(opportunity, contact, mappings, "pickupAddress"),
      pickupCity: mappedText(opportunity, contact, mappings, "pickupCity"),
      pickupState: mappedText(opportunity, contact, mappings, "pickupState"),
      pickupZip: mappedText(opportunity, contact, mappings, "pickupZip"),
      pickupContactName: mappedText(opportunity, contact, mappings, "pickupContactName"),
      pickupContactPhone: mappedText(opportunity, contact, mappings, "pickupContactPhone"),
      pickupDate: asDate(mappedValue(opportunity, contact, mappings, "pickupDate")),
      deliveryAddress: mappedText(opportunity, contact, mappings, "deliveryAddress"),
      deliveryCity: mappedText(opportunity, contact, mappings, "deliveryCity"),
      deliveryState: mappedText(opportunity, contact, mappings, "deliveryState"),
      deliveryZip: mappedText(opportunity, contact, mappings, "deliveryZip"),
      deliveryContactName: mappedText(opportunity, contact, mappings, "deliveryContactName"),
      deliveryContactPhone: mappedText(opportunity, contact, mappings, "deliveryContactPhone"),
      deliveryWindow: mappedText(opportunity, contact, mappings, "deliveryWindow"),
      trailerType: mappedText(opportunity, contact, mappings, "trailerType"),
      customerTotal: new Prisma.Decimal(Number(customerTotal) || 0),
      depositDue: new Prisma.Decimal(Number(depositDue) || 0),
      balanceDue: new Prisma.Decimal(Number(balanceDue) || 0),
      customerNotes: mappedText(opportunity, contact, mappings, "customerNotes"),
      internalNotes: mappedText(opportunity, contact, mappings, "internalNotes"),
      customerSnapshot: {
        update: {
          name: mappedText(opportunity, contact, mappings, "customerName") ?? contactName(contact, opportunity),
          phone: mappedText(opportunity, contact, mappings, "customerPhone") ?? asString(contact?.phone),
          email: mappedText(opportunity, contact, mappings, "customerEmail") ?? asString(contact?.email),
          companyName: mappedText(opportunity, contact, mappings, "customerCompanyName") ?? asString(contact?.companyName),
          rawGhlData: jsonValue({ contact, opportunity }),
        },
      },
      vehicles: {
        deleteMany: {},
        create: {
          year: mappedText(opportunity, contact, mappings, "vehicleYear"),
          make: mappedText(opportunity, contact, mappings, "vehicleMake"),
          model: mappedText(opportunity, contact, mappings, "vehicleModel"),
          type: mappedText(opportunity, contact, mappings, "vehicleType"),
          condition: mappedText(opportunity, contact, mappings, "vehicleCondition"),
          vin: mappedText(opportunity, contact, mappings, "vehicleVin"),
          isRunning: ["true", "yes", "running", "1"].includes(
            String(mappedValue(opportunity, contact, mappings, "vehicleIsRunning") ?? "").toLowerCase(),
          ),
          notes: mappedText(opportunity, contact, mappings, "vehicleNotes"),
          rawVehicleData: jsonValue({
            year: mappedValue(opportunity, contact, mappings, "vehicleYear"),
            make: mappedValue(opportunity, contact, mappings, "vehicleMake"),
            model: mappedValue(opportunity, contact, mappings, "vehicleModel"),
            type: mappedValue(opportunity, contact, mappings, "vehicleType"),
            condition: mappedValue(opportunity, contact, mappings, "vehicleCondition"),
            vin: mappedValue(opportunity, contact, mappings, "vehicleVin"),
          }),
        },
      },
      events: {
        create: {
          type: "REFRESHED_FROM_GHL",
          message: "Refreshed quote snapshot from existing GoHighLevel pipeline lead.",
          metadata: jsonValue({ opportunityId: quote.ghlOpportunityId, contactId }),
        },
      },
    },
    include: { vehicles: true, customerSnapshot: true },
  });

  await prisma.ghlSyncLog.create({
    data: {
      quoteId: quote.id,
      direction: "GHL_TO_APP",
      status: "SUCCESS",
      requestPayload: jsonValue({ quoteId: quote.id, opportunityId: quote.ghlOpportunityId, action: "REFRESH" }),
      responsePayload: jsonValue({ quoteId: quote.id, opportunityId: quote.ghlOpportunityId }),
    },
  });

  const refreshed = await prisma.quote.findUnique({
    where: { id: quote.id },
    include: { vehicles: true, customerSnapshot: true },
  });

  const appToGhlAfter = await prisma.ghlSyncLog.count({
    where: { quoteId: quote.id, direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  console.log(
    JSON.stringify(
      {
        quoteNumber,
        quoteId: quote.id,
        pickup: {
          address: refreshed?.pickupAddress,
          city: refreshed?.pickupCity,
          state: refreshed?.pickupState,
          zip: refreshed?.pickupZip,
          date: refreshed?.pickupDate,
        },
        delivery: {
          address: refreshed?.deliveryAddress,
          city: refreshed?.deliveryCity,
          state: refreshed?.deliveryState,
          zip: refreshed?.deliveryZip,
        },
        vehicle: refreshed?.vehicles[0],
        customerNotes: refreshed?.customerNotes,
        realGhlWriteOccurred: appToGhlAfter > appToGhlBefore,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
