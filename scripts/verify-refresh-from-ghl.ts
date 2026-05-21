/**
 * Read-only refresh-from-GHL verification for multi-account credentials.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { refreshQuoteFromGhl } from "@/server/ghl";
import {
  getGhlCredentialsForLocation,
  hasAnyGhlCredentials,
} from "@/server/ghl-credentials";
import {
  KEENER_GHL_LOCATION_ID,
  OAT_GHL_LOCATION_ID,
} from "@/lib/ghl-field-mappings";

const TESTS = [
  { quoteNumber: "Q-2026-00003", expectedLocation: OAT_GHL_LOCATION_ID, account: "OAT" },
  { quoteNumber: "Q-2026-00004", expectedLocation: KEENER_GHL_LOCATION_ID, account: "Keener" },
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

function tokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function expectedTokenEnvKey(locationId: string) {
  return locationId === OAT_GHL_LOCATION_ID
    ? "OAT_GHL_PRIVATE_INTEGRATION_TOKEN"
    : "KEENER_GHL_PRIVATE_INTEGRATION_TOKEN";
}

async function main() {
  loadEnv();

  const syncBackEnabled = process.env.GHL_SYNC_BACK_ENABLED?.trim().toLowerCase() === "true";
  const oatConfigured = Boolean(process.env.OAT_GHL_PRIVATE_INTEGRATION_TOKEN?.trim());
  const keenerConfigured = Boolean(process.env.KEENER_GHL_PRIVATE_INTEGRATION_TOKEN?.trim());

  console.log(
    JSON.stringify(
      {
        syncBackEnabled,
        oatPrefixedConfigured: oatConfigured,
        keenerPrefixedConfigured: keenerConfigured,
        hasAnyGhlCredentials: hasAnyGhlCredentials(),
      },
      null,
      2,
    ),
  );

  if (syncBackEnabled) throw new Error("GHL_SYNC_BACK_ENABLED must be false for this verification.");
  if (!oatConfigured || !keenerConfigured) {
    throw new Error("Both OAT_GHL_* and KEENER_GHL_* prefixed configs must exist in .env.");
  }

  const prisma = new PrismaClient();
  const appToGhlNonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const results = [];

  for (const test of TESTS) {
    const quoteBefore = await prisma.quote.findUnique({
      where: { quoteNumber: test.quoteNumber },
      include: { customerSnapshot: true },
    });
    if (!quoteBefore?.ghlOpportunityId) {
      throw new Error(`Quote ${test.quoteNumber} not found or missing ghlOpportunityId.`);
    }
    if (quoteBefore.ghlLocationId !== test.expectedLocation) {
      throw new Error(
        `Quote ${test.quoteNumber} ghlLocationId mismatch: expected ${test.expectedLocation}, got ${quoteBefore.ghlLocationId}`,
      );
    }

    const creds = getGhlCredentialsForLocation(test.expectedLocation);
    const expectedEnvKey = expectedTokenEnvKey(test.expectedLocation);
    const expectedToken = process.env[expectedEnvKey]?.trim() ?? "";
    const credentialsMatch =
      creds.ghlLocationId === test.expectedLocation &&
      creds.privateIntegrationToken === expectedToken &&
      tokenFingerprint(creds.privateIntegrationToken) === tokenFingerprint(expectedToken);

    const mappingCount = await prisma.ghlFieldMapping.count({
      where: { ghlLocationId: test.expectedLocation, ghlCustomFieldId: { not: null } },
    });

    let refreshError: string | undefined;
    let quoteAfter = quoteBefore;
    let refreshLog = null;

    try {
      await refreshQuoteFromGhl(quoteBefore.id);
      quoteAfter = (await prisma.quote.findUnique({
        where: { id: quoteBefore.id },
        include: { customerSnapshot: true },
      }))!;
      refreshLog = await prisma.ghlSyncLog.findFirst({
        where: { quoteId: quoteBefore.id, direction: "GHL_TO_APP" },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }

    results.push({
      quoteNumber: test.quoteNumber,
      account: test.account,
      ghlLocationId: test.expectedLocation,
      ghlOpportunityId: quoteBefore.ghlOpportunityId,
      credentialsResolvedLocation: creds.ghlLocationId,
      credentialsUsedPrefixedAccount: credentialsMatch,
      credentialFingerprint: tokenFingerprint(creds.privateIntegrationToken),
      mappingCount,
      refreshSucceeded: !refreshError,
      refreshError,
      refreshLog: refreshLog
        ? { id: refreshLog.id, direction: refreshLog.direction, status: refreshLog.status }
        : null,
      localDataChanged:
        quoteBefore.updatedAt.getTime() !== quoteAfter.updatedAt.getTime() ||
        quoteBefore.customerSnapshot.name !== quoteAfter.customerSnapshot?.name,
    });

    if (refreshError) {
      console.log(JSON.stringify({ results }, null, 2));
      throw new Error(`${test.account} refresh failed: ${refreshError}`);
    }
    if (!credentialsMatch) {
      throw new Error(`${test.account} refresh did not resolve prefixed credentials for ${test.expectedLocation}.`);
    }
    if (refreshLog?.direction !== "GHL_TO_APP" || refreshLog.status !== "SUCCESS") {
      throw new Error(`${test.account} refresh log missing GHL_TO_APP / SUCCESS.`);
    }
  }

  const appToGhlNonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  console.log(
    JSON.stringify(
      {
        results,
        appToGhlNonSkippedBefore,
        appToGhlNonSkippedAfter,
        realGhlWriteOccurred: appToGhlNonSkippedAfter > appToGhlNonSkippedBefore,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
