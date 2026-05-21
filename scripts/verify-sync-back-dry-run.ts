/**
 * Dry-run sync-back payload verification for OAT and Keener test quotes.
 * Calls syncQuoteToGhl (real writes disabled) and validates GhlSyncLog payloads.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { syncQuoteToGhl } from "@/server/ghl-sync-back";
import { KEENER_GHL_LOCATION_ID, OAT_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";

const REQUIRED_WITH_VALUE = [
  "quoteNumber",
  "quoteMode",
  "quoteStatus",
  "quoteTotal",
  "depositDue",
  "balanceDue",
  "quoteAcceptanceUrl",
] as const;

const CONDITIONAL = [
  "quotePdfUrl",
  "acceptedAt",
  "declinedAt",
  "declineReason",
  "latestCustomerQuestion",
] as const;

type MappedField = {
  appFieldKey: string;
  value: string | null;
  ghlCustomFieldId: string | null;
  ghlCustomFieldName?: string | null;
};

type SkippedField = {
  appFieldKey: string;
  value: string | null;
  reason?: string;
};

function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function loadLocationFieldIds(prisma: PrismaClient, locationId: string) {
  const rows = await prisma.ghlFieldMapping.findMany({
    where: { ghlLocationId: locationId, ghlCustomFieldId: { not: null } },
    select: { appFieldKey: true, ghlCustomFieldId: true },
  });
  return new Map(rows.map((row) => [row.appFieldKey, row.ghlCustomFieldId as string]));
}

async function verifyQuote(
  prisma: PrismaClient,
  quoteNumber: string,
  expected: {
    ghlLocationId: string;
    companyName: string;
    quoteMode: string;
  },
  locationFieldIds: Map<string, string>,
  otherLocationFieldIds: Set<string>,
) {
  const quote = await prisma.quote.findUnique({
    where: { quoteNumber },
    include: { company: true, customerMessages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!quote) throw new Error(`Quote ${quoteNumber} not found.`);

  const checks = {
    ghlLocationId: quote.ghlLocationId === expected.ghlLocationId,
    company: quote.company.name === expected.companyName,
    quoteMode: quote.quoteMode === expected.quoteMode,
    ghlOpportunityId: Boolean(quote.ghlOpportunityId),
  };

  const result = await syncQuoteToGhl(quote.id, { trigger: "DRY_RUN_VERIFICATION" });
  const log = await prisma.ghlSyncLog.findUnique({ where: { id: result.logId } });
  const request = asRecord(log?.requestPayload);
  const response = asRecord(log?.responsePayload);

  const mappedFields = (request?.mappedFields as MappedField[] | undefined) ?? [];
  const skippedFields = (request?.skippedFields as SkippedField[] | undefined) ?? [];
  const updatePayload = asRecord(response?.updatePayload);
  const updateCustomFields = (updatePayload?.customFields as MappedField[] | undefined) ?? [];

  const mappedByKey = new Map(mappedFields.map((field) => [field.appFieldKey, field]));
  const requiredResolved = REQUIRED_WITH_VALUE.every((key) => {
    const field = mappedByKey.get(key);
    return Boolean(field?.ghlCustomFieldId && field.value);
  });

  const conditionalResults = CONDITIONAL.map((key) => {
    const hasValue = Boolean(request?.fieldValues && asRecord(request.fieldValues)?.[key]);
    const mapped = mappedByKey.get(key);
    if (!hasValue) return { key, status: "skipped_no_value" as const };
    if (mapped?.ghlCustomFieldId) return { key, status: "mapped" as const, id: mapped.ghlCustomFieldId };
    const skipped = skippedFields.find((field) => field.appFieldKey === key);
    return { key, status: "missing_mapping" as const, reason: skipped?.reason };
  });

  const usedIds = mappedFields.map((field) => field.ghlCustomFieldId).filter(Boolean) as string[];
  const wrongLocationIds = usedIds.filter((id) => otherLocationFieldIds.has(id));
  const correctLocationIds = usedIds.every((id) => Object.values([...locationFieldIds.values()]).includes(id));

  const idMismatches = mappedFields
    .filter((field) => field.ghlCustomFieldId && locationFieldIds.get(field.appFieldKey) !== field.ghlCustomFieldId)
    .map((field) => field.appFieldKey);

  return {
    quoteNumber,
    quoteId: quote.id,
    metadataChecks: checks,
    syncStatus: result.status,
    syncMessage: result.message,
    logId: result.logId,
    ghlLocationId: request?.ghlLocationId,
    mappedCount: mappedFields.length,
    skippedCount: skippedFields.length,
    requiredResolved,
    conditionalResults,
    updatePayloadFieldCount: updateCustomFields.length,
    usedFieldIds: usedIds,
    wrongLocationIds,
    idMismatches,
    correctLocationIds: wrongLocationIds.length === 0 && idMismatches.length === 0,
    mappedFields: mappedFields.map((field) => ({
      appFieldKey: field.appFieldKey,
      ghlCustomFieldId: field.ghlCustomFieldId,
      hasValue: Boolean(field.value),
    })),
    skippedFields: skippedFields.map((field) => ({
      appFieldKey: field.appFieldKey,
      reason: field.reason,
    })),
  };
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();

  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const realWriteEnabled = process.env.GHL_SYNC_BACK_ENABLED?.trim().toLowerCase() === "true";
  console.log(`GHL_SYNC_BACK_ENABLED: ${realWriteEnabled ? "true" : "false/off"}`);

  const oatFieldIds = await loadLocationFieldIds(prisma, OAT_GHL_LOCATION_ID);
  const keenerFieldIds = await loadLocationFieldIds(prisma, KEENER_GHL_LOCATION_ID);
  const oatIdSet = new Set(oatFieldIds.values());
  const keenerIdSet = new Set(keenerFieldIds.values());

  console.log("=== Quote metadata ===");
  const oat = await verifyQuote(
    prisma,
    "Q-2026-00003",
    {
      ghlLocationId: OAT_GHL_LOCATION_ID,
      companyName: "Organized Auto Transport",
      quoteMode: "OAT_DIRECT",
    },
    oatFieldIds,
    keenerIdSet,
  );
  console.log(JSON.stringify(oat, null, 2));

  console.log("\n=== Keener dry-run ===");
  const keener = await verifyQuote(
    prisma,
    "Q-2026-00004",
    {
      ghlLocationId: KEENER_GHL_LOCATION_ID,
      companyName: "Keener Logistics",
      quoteMode: "KEENER_LOGISTICS",
    },
    keenerFieldIds,
    oatIdSet,
  );
  console.log(JSON.stringify(keener, null, 2));

  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const pass =
    Object.values(oat.metadataChecks).every(Boolean) &&
    Object.values(keener.metadataChecks).every(Boolean) &&
    oat.syncStatus === "SKIPPED" &&
    keener.syncStatus === "SKIPPED" &&
    oat.requiredResolved &&
    keener.requiredResolved &&
    oat.correctLocationIds &&
    keener.correctLocationIds &&
    nonSkippedAfter === nonSkippedBefore;

  console.log("\n=== Summary flags ===");
  console.log(
    JSON.stringify(
      {
        oatSkipped: oat.syncStatus === "SKIPPED",
        keenerSkipped: keener.syncStatus === "SKIPPED",
        oatRequiredResolved: oat.requiredResolved,
        keenerRequiredResolved: keener.requiredResolved,
        oatLocationIdsCorrect: oat.correctLocationIds,
        keenerLocationIdsCorrect: keener.correctLocationIds,
        realGhlWriteOccurred: nonSkippedAfter > nonSkippedBefore,
        nonSkippedBefore,
        nonSkippedAfter,
        overallPass: pass,
      },
      null,
      2,
    ),
  );

  if (!pass) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
