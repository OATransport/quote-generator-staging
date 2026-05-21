/**
 * Create missing Keener opportunity quote-result custom fields in GHL and save mappings (DB + GHL field create only).
 * Does not update contacts, opportunities, notes, or messages.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { createMissingQuoteResultFields, getGhlCustomFields } from "@/server/ghl";
import { KEENER_GHL_LOCATION_ID, OAT_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";

const REQUIRED_KEENER_QUOTE_RESULT_KEYS = [
  "quoteNumber",
  "quoteMode",
  "quoteStatus",
  "quoteTotal",
  "depositDue",
  "balanceDue",
  "quotePdfUrl",
  "quoteAcceptanceUrl",
  "acceptedAt",
  "declinedAt",
  "declineReason",
  "latestCustomerQuestion",
] as const;

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

async function main() {
  loadEnv();

  const locationId = process.env.GHL_LOCATION_ID?.trim();
  const mockMode = !process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();

  if (locationId !== KEENER_GHL_LOCATION_ID) {
    throw new Error(
      `Active env is not Keener. Expected GHL_LOCATION_ID=${KEENER_GHL_LOCATION_ID}, got ${locationId ?? "unset"}.`,
    );
  }
  if (mockMode) {
    throw new Error("Mock mode is ON (GHL_PRIVATE_INTEGRATION_TOKEN missing). Refusing to continue.");
  }

  const prisma = new PrismaClient();
  const oatBefore = await prisma.ghlFieldMapping.count({ where: { ghlLocationId: OAT_GHL_LOCATION_ID } });

  const existingBefore = await getGhlCustomFields();
  const opportunityBefore = existingBefore.filter((field) => field.model === "opportunity");

  console.log(`Active account: Keener (${KEENER_GHL_LOCATION_ID})`);
  console.log(`Mock mode: OFF`);
  console.log(`Existing GHL custom fields (all models): ${existingBefore.length}`);
  console.log(`Existing GHL opportunity custom fields: ${opportunityBefore.length}`);

  const result = await createMissingQuoteResultFields();

  const existingAfter = await getGhlCustomFields();
  const opportunityAfter = existingAfter.filter((field) => field.model === "opportunity");

  const mappings = await prisma.ghlFieldMapping.findMany({
    where: {
      ghlLocationId: KEENER_GHL_LOCATION_ID,
      appFieldKey: { in: [...REQUIRED_KEENER_QUOTE_RESULT_KEYS] },
    },
    orderBy: { appFieldKey: "asc" },
  });

  const expirationMapping = await prisma.ghlFieldMapping.findFirst({
    where: { ghlLocationId: KEENER_GHL_LOCATION_ID, appFieldKey: "quoteExpirationDate" },
  });

  const complete = REQUIRED_KEENER_QUOTE_RESULT_KEYS.every((key) => {
    const mapping = mappings.find((row) => row.appFieldKey === key);
    return Boolean(mapping?.ghlCustomFieldId);
  });

  const oatAfter = await prisma.ghlFieldMapping.count({ where: { ghlLocationId: OAT_GHL_LOCATION_ID } });

  console.log("\n=== Field creation ===");
  console.log(`Created: ${result.created.map((row) => row.appFieldKey).join(", ") || "(none)"}`);
  console.log(`Mapped existing: ${result.mappedExisting.map((row) => row.appFieldKey).join(", ") || "(none)"}`);
  console.log(`Skipped: ${result.skipped.map((row) => `${row.appFieldKey} (${row.reason})`).join(", ") || "(none)"}`);
  if (result.failed.length) {
    for (const row of result.failed) {
      console.error(`FAILED — ${row.appFieldKey}: ${row.error}`);
    }
    process.exitCode = 1;
  }

  console.log("\n=== Read-back verification ===");
  console.log(`Opportunity custom fields after: ${opportunityAfter.length}`);
  for (const key of REQUIRED_KEENER_QUOTE_RESULT_KEYS) {
    const mapping = mappings.find((row) => row.appFieldKey === key);
    const status = mapping?.ghlCustomFieldId ? "OK" : "MISSING";
    console.log(`${status} — ${key} -> ${mapping?.ghlCustomFieldName ?? "unmapped"} (${mapping?.ghlCustomFieldId ?? "no id"})`);
  }
  if (expirationMapping?.ghlCustomFieldId) {
    console.log(
      `OK — quoteExpirationDate -> ${expirationMapping.ghlCustomFieldName} (${expirationMapping.ghlCustomFieldId})`,
    );
  }

  console.log(`\nAll 12 required Keener quote-result mappings complete: ${complete ? "yes" : "no"}`);
  console.log(`OAT mapping rows unchanged: ${oatBefore === oatAfter ? "yes" : "no"} (${oatBefore} -> ${oatAfter})`);
  console.log("Contacts/opportunities updated: no (custom field create + DB mapping only)");

  if (!complete) process.exitCode = 1;

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
