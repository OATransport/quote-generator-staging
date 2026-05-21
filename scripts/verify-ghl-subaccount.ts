/**
 * READ-ONLY GoHighLevel sub-account verification.
 * Usage: npx tsx scripts/verify-ghl-subaccount.ts "Keener Logistics"
 * Does not create, update, or delete any GHL records.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const subaccountName = process.argv[2]?.trim() || "GoHighLevel sub-account";

loadEnv();

const QUOTE_RESULT_FIELD_LABELS = [
  "Quote Number",
  "Quote Mode",
  "Quote Status",
  "Quote Total",
  "Deposit Due",
  "Balance Due",
  "Quote PDF URL",
  "Public Acceptance URL",
  "Accepted At",
  "Declined At",
  "Decline Reason",
  "Latest Customer Question",
] as const;

const QUOTE_FIELD_ALIASES: Record<(typeof QUOTE_RESULT_FIELD_LABELS)[number], string[]> = {
  "Quote Number": ["quote number", "quotenumber"],
  "Quote Mode": ["quote mode", "quotemode"],
  "Quote Status": ["quote status", "quotestatus"],
  "Quote Total": ["quote total", "quotetotal"],
  "Deposit Due": ["deposit due", "depositdue"],
  "Balance Due": ["balance due", "balancedue"],
  "Quote PDF URL": ["quote pdf url", "quotepdfurl", "quote pdf"],
  "Public Acceptance URL": ["public acceptance url", "quote acceptance url", "acceptance url"],
  "Accepted At": ["accepted at", "acceptedat"],
  "Declined At": ["declined at", "declinedat"],
  "Decline Reason": ["decline reason", "declinereason"],
  "Latest Customer Question": ["latest customer question", "customer question"],
};

const INTAKE_FIELD_PATTERN =
  /pickup|delivery|vehicle|quote|shipment|trailer|utm|landing|customer type|flexibility|transport/i;

type GhlResponseError = {
  endpoint: string;
  status: number;
  message: string;
  hint: string;
};

type CustomField = {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
  model?: string;
};

type Pipeline = {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string }>;
};

function loadEnv() {
  try {
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
  } catch {
    // .env optional if vars already exported
  }
}

function isMockMode() {
  return !process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
}

function baseUrl() {
  return (process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
}

function apiVersion() {
  return process.env.GHL_API_VERSION ?? "2021-07-28";
}

function cleanEnv(value?: string) {
  const text = value?.trim();
  return text && text !== '""' && text !== "''" ? text : undefined;
}

async function ghlRead<T>(endpoint: string, hint: string): Promise<T> {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  if (!token) {
    throw formatError({
      endpoint,
      status: 0,
      message: "GHL_PRIVATE_INTEGRATION_TOKEN is not set.",
      hint: "Set the Private Integration token in .env.",
    });
  }

  const response = await fetch(`${baseUrl()}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: apiVersion(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw formatError({
      endpoint,
      status: response.status,
      message: bodyText || response.statusText,
      hint,
    });
  }

  return (bodyText ? JSON.parse(bodyText) : {}) as T;
}

function formatError(error: GhlResponseError): Error {
  const message = [
    "GHL read request failed.",
    `Endpoint: ${error.endpoint}`,
    `Status: ${error.status}`,
    `Error: ${error.message}`,
    `Likely cause: ${error.hint}`,
  ].join("\n");
  return new Error(message);
}

function normalizeCustomFields(data: unknown): CustomField[] {
  const object = data as Record<string, unknown>;
  const fields = (object.customFields ?? object.fields ?? object.data ?? []) as Array<Record<string, unknown>>;
  return fields
    .map((field) => ({
      id: String(field.id ?? ""),
      name: String(field.name ?? field.fieldKey ?? "Untitled field"),
      fieldKey: field.fieldKey ? String(field.fieldKey) : field.key ? String(field.key) : undefined,
      dataType: field.dataType ? String(field.dataType) : undefined,
      model: field.model ? String(field.model) : undefined,
    }))
    .filter((field) => field.id);
}

function normalizePipelines(data: unknown): Pipeline[] {
  const object = data as Record<string, unknown>;
  const pipelines = (object.pipelines ?? object.data ?? []) as Array<Record<string, unknown>>;
  return pipelines
    .map((pipeline) => ({
      id: String(pipeline.id ?? ""),
      name: String(pipeline.name ?? "Untitled pipeline"),
      stages: ((pipeline.stages ?? []) as Array<Record<string, unknown>>).map((stage) => ({
        id: String(stage.id ?? ""),
        name: String(stage.name ?? "Untitled stage"),
      })),
    }))
    .filter((pipeline) => pipeline.id);
}

function normalizeLocations(data: unknown): Array<{ id: string; name: string }> {
  const object = data as Record<string, unknown>;
  const locations = (object.locations ?? object.data ?? []) as Array<Record<string, unknown>>;
  return locations
    .map((location) => ({
      id: String(location.id ?? ""),
      name: String(location.name ?? location.companyName ?? "Untitled location"),
    }))
    .filter((location) => location.id);
}

function fieldMatches(field: CustomField, aliases: string[]) {
  const haystack = [field.name, field.fieldKey].filter(Boolean).join(" ").toLowerCase();
  return aliases.some((alias) => haystack.includes(alias));
}

function isIntakeField(field: CustomField) {
  const haystack = [field.name, field.fieldKey].filter(Boolean).join(" ");
  return INTAKE_FIELD_PATTERN.test(haystack);
}

function recommendPipeline(pipelines: Pipeline[]) {
  const preferred = pipelines.find((pipeline) => /quote|transport|lead|sales|request|pipeline/i.test(pipeline.name));
  return preferred ?? pipelines[0];
}

function recommendStage(pipeline?: Pipeline) {
  if (!pipeline?.stages.length) return undefined;
  const preferred = pipeline.stages.find((stage) => /new|lead|quote|request|inquiry|open/i.test(stage.name));
  return preferred ?? pipeline.stages[0];
}

async function testScope(
  name: string,
  endpoint: string,
  hint: string,
): Promise<{ name: string; ok: boolean; detail: string }> {
  try {
    await ghlRead(endpoint, hint);
    return { name, ok: true, detail: "OK" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail: message.split("\n").slice(0, 4).join(" | ") };
  }
}

async function discoverLocationId(): Promise<{ id: string; name: string; source: string }> {
  try {
    const searchData = await ghlRead<unknown>("/locations/search", "Token may lack locations.readonly scope.");
    const locations = normalizeLocations(searchData);
    if (locations.length === 1) {
      return { ...locations[0], source: "GET /locations/search" };
    }
    if (locations.length > 1) {
      const keener = locations.find((location) => /keener/i.test(location.name));
      if (keener) return { ...keener, source: "GET /locations/search (name match)" };
      return { ...locations[0], source: "GET /locations/search (first result)" };
    }
  } catch {
    // fall through
  }

  try {
    const contactData = await ghlRead<Record<string, unknown>>(
      "/contacts/?limit=1",
      "Token may lack contacts.readonly scope or location context.",
    );
    const contacts = (contactData.contacts ?? contactData.data ?? []) as Array<Record<string, unknown>>;
    const locationId = contacts[0]?.locationId ? String(contacts[0].locationId) : undefined;
    if (locationId) {
      const location = await ghlRead<Record<string, unknown>>(
        `/locations/${encodeURIComponent(locationId)}`,
        "Discovered location ID could not be verified.",
      );
      const nested = location.location as Record<string, unknown> | undefined;
      const name = String(nested?.name ?? location.name ?? location.companyName ?? locationId);
      return { id: locationId, name, source: "GET /contacts/?limit=1" };
    }
  } catch {
    // fall through
  }

  throw new Error(
    "GHL_LOCATION_ID is blank and automatic location discovery failed. Set GHL_LOCATION_ID in .env from the Keener sub-account settings URL.",
  );
}

async function main() {
  console.log(`=== ${subaccountName} GoHighLevel READ-ONLY Verification ===\n`);

  const mockMode = isMockMode();
  console.log(`1. Mock mode: ${mockMode ? "ON (token missing)" : "OFF"}`);
  if (mockMode) {
    throw new Error("Mock mode is ON. Set GHL_PRIVATE_INTEGRATION_TOKEN before verifying.");
  }

  console.log(`2. API base URL: ${baseUrl()}`);
  console.log(`   Version header: ${apiVersion()}`);

  let locationId = cleanEnv(process.env.GHL_LOCATION_ID);
  let locationName = "Unknown";
  let locationSource = "GHL_LOCATION_ID env var";

  if (locationId) {
    console.log(`\n3. Verifying configured location ID: ${locationId}`);
    const location = await ghlRead<Record<string, unknown>>(
      `/locations/${encodeURIComponent(locationId)}`,
      "Token may lack locations.readonly scope, or GHL_LOCATION_ID may be wrong for this sub-account.",
    );
    const nested = location.location as Record<string, unknown> | undefined;
    locationName = String(nested?.name ?? location.name ?? location.companyName ?? "Unknown");
    const locationCompany = String(nested?.companyName ?? location.companyName ?? "");
    console.log(`   Location confirmed: ${locationName}${locationCompany ? ` (${locationCompany})` : ""}`);
  } else {
    console.log("\n3. GHL_LOCATION_ID is blank — attempting read-only location discovery...");
    const discovered = await discoverLocationId();
    locationId = discovered.id;
    locationName = discovered.name;
    locationSource = discovered.source;
    console.log(`   Discovered location: ${locationName} (${locationId}) via ${locationSource}`);
  }

  console.log(`\n4. Location ID: ${locationId}`);

  console.log("\n5. Fetching pipelines...");
  const pipelineData = await ghlRead<unknown>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    "Token may lack opportunities.readonly or pipelines.readonly scope.",
  );
  const pipelines = normalizePipelines(pipelineData);

  console.log("\n6. Pipelines:");
  for (const pipeline of pipelines) {
    console.log(`   - ${pipeline.name} (${pipeline.id})`);
    console.log("     Stages:");
    for (const stage of pipeline.stages) {
      console.log(`       • ${stage.name} (${stage.id})`);
    }
  }

  console.log("\n7. Fetching custom fields...");
  const customFieldData = await ghlRead<unknown>(
    `/locations/${encodeURIComponent(locationId)}/customFields`,
    "Token may lack locations/customFields.readonly scope.",
  );
  const customFields = normalizeCustomFields(customFieldData);
  const intakeFields = customFields.filter(isIntakeField);

  console.log(`\n8. Custom fields found: ${customFields.length} total`);
  const modelCounts = customFields.reduce<Record<string, number>>((acc, field) => {
    const model = field.model ?? "(unspecified)";
    acc[model] = (acc[model] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`   By model: ${Object.entries(modelCounts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  for (const field of customFields) {
    console.log(`   - ${field.name} (${field.id})${field.model ? ` [${field.model}]` : ""}${field.fieldKey ? ` key=${field.fieldKey}` : ""}`);
  }

  console.log(`\n8b. Quote/intake-related custom fields (${intakeFields.length}):`);
  for (const field of intakeFields) {
    console.log(`   - ${field.name} (${field.id})${field.fieldKey ? ` key=${field.fieldKey}` : ""}`);
  }

  console.log("\n9. Quote-result sync-back fields matched:");
  const foundQuoteFields: Array<{ label: string; field: CustomField }> = [];
  const missingQuoteFields: string[] = [];

  for (const label of QUOTE_RESULT_FIELD_LABELS) {
    const aliases = QUOTE_FIELD_ALIASES[label];
    const match = customFields.find((field) => fieldMatches(field, aliases));
    if (match) {
      foundQuoteFields.push({ label, field: match });
      console.log(`   ✓ ${label} -> ${match.name} (${match.id})`);
    } else {
      missingQuoteFields.push(label);
      console.log(`   ✗ ${label} -> not found`);
    }
  }

  console.log("\n10. Scope checks (read-only):");
  const scopeChecks = await Promise.all([
    testScope(
      "contacts.read",
      `/contacts/?locationId=${encodeURIComponent(locationId)}&limit=1`,
      "Token may lack contacts.readonly scope.",
    ),
    testScope(
      "opportunities.read",
      `/opportunities/search?location_id=${encodeURIComponent(locationId)}&limit=1`,
      "Token may lack opportunities.readonly scope.",
    ),
    testScope(
      "pipelines.read",
      `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
      "Token may lack pipelines.readonly scope.",
    ),
    testScope(
      "customFields.read",
      `/locations/${encodeURIComponent(locationId)}/customFields`,
      "Token may lack customFields.readonly scope.",
    ),
  ]);

  for (const check of scopeChecks) {
    console.log(`   ${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
  }

  const recommendedPipeline = recommendPipeline(pipelines);
  const recommendedStage = recommendStage(recommendedPipeline);
  const missingScopes = scopeChecks.filter((check) => !check.ok).map((check) => check.name);

  console.log("\n=== Summary JSON ===");
  console.log(
    JSON.stringify(
      {
        subaccountName,
        mockModeOff: !mockMode,
        tokenAuthWorks: true,
        locationId,
        locationName,
        locationSource,
        pipelines: pipelines.map((pipeline) => ({
          id: pipeline.id,
          name: pipeline.name,
          stages: pipeline.stages,
        })),
        recommendedQuotePipelineId: recommendedPipeline?.id ?? null,
        recommendedDefaultStageId: recommendedStage?.id ?? null,
        recommendedQuotePipelineName: recommendedPipeline?.name ?? null,
        recommendedDefaultStageName: recommendedStage?.name ?? null,
        customFieldsFound: customFields.length,
        customFieldModels: modelCounts,
        intakeFieldsFound: intakeFields.map((field) => ({
          id: field.id,
          name: field.name,
          fieldKey: field.fieldKey,
          model: field.model,
        })),
        quoteFieldsFound: foundQuoteFields.map(({ label, field }) => ({
          label,
          id: field.id,
          name: field.name,
          fieldKey: field.fieldKey,
        })),
        quoteFieldsMissing: missingQuoteFields,
        missingScopes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("\nVERIFICATION STOPPED:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
