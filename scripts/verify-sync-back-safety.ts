/**
 * Verify manual-only GHL sync-back safety rules without performing real GHL writes.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { evaluateSyncBackWritePermission } from "@/server/ghl-sync-back-policy";
import { syncQuoteToGhl } from "@/server/ghl-sync-back";

const KEENER_QUOTE_NUMBER = "Q-2026-00004";

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

function payloadFields(log: { requestPayload: unknown; responsePayload: unknown; status: string; errorMessage: string | null }) {
  const request = (log.requestPayload ?? {}) as Record<string, unknown>;
  const response = (log.responsePayload ?? {}) as Record<string, unknown>;
  const permission = (response.permission ?? request) as Record<string, unknown>;
  return {
    status: log.status,
    trigger: request.trigger,
    triggerKind: request.triggerKind ?? permission.triggerKind,
    realWriteAllowed: request.realWriteAllowed ?? permission.realWriteAllowed,
    skipReason: request.skipReason ?? permission.skipReason,
    message: log.errorMessage,
  };
}

async function runSkippedSyncTests(quoteId: string) {
  process.env.GHL_SYNC_BACK_ENABLED = "false";
  process.env.GHL_AUTO_SYNC_BACK_ENABLED = "false";

  const triggers = ["MANUAL", "PDF_GENERATED", "CUSTOMER_QUESTION"] as const;
  const results = [];

  for (const trigger of triggers) {
    const result = await syncQuoteToGhl(quoteId, { trigger });
    const log = await prisma.ghlSyncLog.findUnique({ where: { id: result.logId } });
    if (!log) throw new Error(`Missing log for ${trigger}`);

    const fields = payloadFields(log);
    const pass =
      result.status === "SKIPPED" &&
      log.status === "SKIPPED" &&
      fields.realWriteAllowed === false &&
      String(fields.skipReason).includes("GHL_SYNC_BACK_ENABLED");

    results.push({ pass, ...fields, trigger });
  }

  return results;
}

function runPolicyDryRun() {
  process.env.GHL_SYNC_BACK_ENABLED = "true";
  process.env.GHL_AUTO_SYNC_BACK_ENABLED = "false";

  const manual = evaluateSyncBackWritePermission("MANUAL");
  const pdf = evaluateSyncBackWritePermission("PDF_GENERATED");
  const question = evaluateSyncBackWritePermission("CUSTOMER_QUESTION");
  const accepted = evaluateSyncBackWritePermission("CUSTOMER_ACCEPTED");
  const declined = evaluateSyncBackWritePermission("CUSTOMER_DECLINED");

  const pass =
    manual.realWriteAllowed === true &&
    manual.triggerKind === "manual" &&
    pdf.realWriteAllowed === false &&
    pdf.triggerKind === "automatic" &&
    pdf.skipReason === "Automatic real sync is disabled; use manual sync." &&
    question.realWriteAllowed === false &&
    accepted.realWriteAllowed === false &&
    declined.realWriteAllowed === false;

  return {
    pass,
    manual,
    pdf,
    question,
    accepted,
    declined,
  };
}

const prisma = new PrismaClient();

async function main() {
  loadEnv();

  const originalSync = process.env.GHL_SYNC_BACK_ENABLED;
  const originalAuto = process.env.GHL_AUTO_SYNC_BACK_ENABLED;

  const quote = await prisma.quote.findUnique({ where: { quoteNumber: KEENER_QUOTE_NUMBER } });
  if (!quote) throw new Error(`Quote ${KEENER_QUOTE_NUMBER} not found.`);

  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const skippedTests = await runSkippedSyncTests(quote.id);
  const policyDryRun = runPolicyDryRun();

  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  process.env.GHL_SYNC_BACK_ENABLED = originalSync;
  process.env.GHL_AUTO_SYNC_BACK_ENABLED = originalAuto;

  await prisma.$disconnect();

  const summary = {
    skippedTests,
    policyDryRun,
    nonSkippedBefore,
    nonSkippedAfter,
    anyRealWriteDetected: nonSkippedAfter > nonSkippedBefore,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (summary.anyRealWriteDetected) {
    throw new Error("Detected non-SKIPPED APP_TO_GHL logs during safety verification.");
  }

  if (!skippedTests.every((row) => row.pass)) {
    throw new Error("One or more GHL_SYNC_BACK_ENABLED=false sync tests failed.");
  }

  if (!policyDryRun.pass) {
    throw new Error("Policy dry-run did not match expected manual-only rules.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
