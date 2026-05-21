/**
 * Read-only import search verification for multi-account GHL credentials.
 * Does not import opportunities or write back to GHL.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { ghlLocationIdForAccountKey } from "@/lib/ghl-accounts";
import { KEENER_GHL_LOCATION_ID, OAT_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";
import { searchGhlPipelineOpportunities } from "@/server/ghl";
import { getGhlCredentialsForLocation, hasAnyGhlCredentials } from "@/server/ghl-credentials";

const OAT_TEST_OPP_ID = "orlebrOtaE52Uyy9WLjz";
const KEENER_TEST_OPP_ID = "RFpzzOpWqlH2BDNC7kGj";

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

function tokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

async function verifyAccountSearch(account: "oat" | "keener", testOpportunityId: string) {
  const ghlLocationId = ghlLocationIdForAccountKey(account);
  const credentials = getGhlCredentialsForLocation(ghlLocationId);

  const listResults = await searchGhlPipelineOpportunities("", { account });
  const idResults = await searchGhlPipelineOpportunities(testOpportunityId, { account });
  const foundTestOpp = idResults.some((result) => result.id === testOpportunityId);

  return {
    account,
    ghlLocationId: credentials.ghlLocationId,
    pipelineId: credentials.quotePipelineId,
    defaultStageId: credentials.defaultStageId,
    tokenFingerprint: tokenFingerprint(credentials.privateIntegrationToken),
    listResultCount: listResults.length,
    sampleListIds: listResults.slice(0, 3).map((result) => result.id),
    testOpportunityId,
    testOpportunityFound: foundTestOpp,
    testOpportunityName: idResults.find((result) => result.id === testOpportunityId)?.name ?? null,
  };
}

async function main() {
  loadEnv();

  const syncBackEnabled = process.env.GHL_SYNC_BACK_ENABLED?.trim().toLowerCase() === "true";
  if (syncBackEnabled) throw new Error("GHL_SYNC_BACK_ENABLED must be false for this verification.");
  if (!hasAnyGhlCredentials()) throw new Error("No GHL credentials configured.");

  const prisma = new PrismaClient();
  const appToGhlNonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const oat = await verifyAccountSearch("oat", OAT_TEST_OPP_ID);
  const keener = await verifyAccountSearch("keener", KEENER_TEST_OPP_ID);

  const appToGhlNonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  await prisma.$disconnect();

  const summary = {
    syncBackEnabled,
    oatPrefixedConfigured: Boolean(process.env.OAT_GHL_PRIVATE_INTEGRATION_TOKEN?.trim()),
    keenerPrefixedConfigured: Boolean(process.env.KEENER_GHL_PRIVATE_INTEGRATION_TOKEN?.trim()),
    expectedLocations: {
      oat: OAT_GHL_LOCATION_ID,
      keener: KEENER_GHL_LOCATION_ID,
    },
    oat,
    keener,
    appToGhlNonSkippedBefore,
    appToGhlNonSkippedAfter,
    anyGhlWriteDetected: appToGhlNonSkippedAfter > appToGhlNonSkippedBefore,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (oat.ghlLocationId !== OAT_GHL_LOCATION_ID) {
    throw new Error(`OAT search used unexpected location: ${oat.ghlLocationId}`);
  }
  if (keener.ghlLocationId !== KEENER_GHL_LOCATION_ID) {
    throw new Error(`Keener search used unexpected location: ${keener.ghlLocationId}`);
  }
  if (summary.anyGhlWriteDetected) {
    throw new Error("Detected APP_TO_GHL writes during read-only search verification.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
