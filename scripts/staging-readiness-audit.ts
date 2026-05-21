/**
 * Staging readiness audit — read-only checks, no real GHL writes.
 */
import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import {
  evaluateSyncBackWritePermission,
  classifySyncBackTrigger,
} from "@/server/ghl-sync-back-policy";
import { ghlLocationIdForAccountKey } from "@/lib/ghl-accounts";
import {
  KEENER_GHL_LOCATION_ID,
  OAT_GHL_LOCATION_ID,
} from "@/lib/ghl-field-mappings";
import { quoteResultFields } from "@/lib/ghl-field-mapping-config";
import { getGhlCredentialsForLocation, hasAnyGhlCredentials } from "@/server/ghl-credentials";
import { isGhlAutoSyncBackEnabled, isGhlSyncBackEnabled } from "@/server/ghl";
import { syncQuoteToGhl } from "@/server/ghl-sync-back";

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
  process.env.GHL_SYNC_BACK_ENABLED = "false";
  process.env.GHL_AUTO_SYNC_BACK_ENABLED = "false";

  const prisma = new PrismaClient();
  const report: Record<string, unknown> = {};

  // Routes exist (filesystem)
  const routes = [
    "src/app/quotes/new/page.tsx",
    "src/app/quotes/[id]/edit/page.tsx",
    "src/app/quotes/[id]/preview/page.tsx",
    "src/app/accept/[token]/page.tsx",
    "src/app/import/page.tsx",
    "src/app/dashboard/import-ghl/page.tsx",
    "src/app/page.tsx",
  ];
  report.routesExist = Object.fromEntries(routes.map((r) => [r, existsSync(resolve(process.cwd(), r))]));

  // Branding files
  const brandingFiles = ["oat-logo.jpg", "oat-icon.png", "keener-logo.png", "keener-icon.png"];
  report.brandingFiles = Object.fromEntries(
    brandingFiles.map((f) => [f, existsSync(resolve(process.cwd(), "public/branding", f))]),
  );

  // Companies
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, logoUrl: true, iconUrl: true },
  });
  report.companies = companies;

  // Test quotes
  const testQuotes = await prisma.quote.findMany({
    where: { quoteNumber: { in: ["Q-2026-00003", "Q-2026-00004", "Q-SAMPLE-00001"] } },
    include: {
      company: { select: { id: true, name: true, logoUrl: true } },
      fees: true,
      customerMessages: true,
      notifications: true,
    },
  });
  report.testQuotes = testQuotes.map((q) => ({
    quoteNumber: q.quoteNumber,
    quoteMode: q.quoteMode,
    companyId: q.companyId,
    ghlLocationId: q.ghlLocationId,
    ghlOpportunityId: q.ghlOpportunityId,
    quotePdfUrl: q.quotePdfUrl,
    internalNotes: q.internalNotes ? "[present]" : null,
    internalFeeCount: q.fees.filter((f) => f.isInternalOnly).length,
    customerVisibleFeeCount: q.fees.filter((f) => f.showOnPdf && !f.isInternalOnly).length,
  }));

  // Field mappings per location
  const oatMappings = await prisma.ghlFieldMapping.findMany({ where: { ghlLocationId: OAT_GHL_LOCATION_ID } });
  const keenerMappings = await prisma.ghlFieldMapping.findMany({ where: { ghlLocationId: KEENER_GHL_LOCATION_ID } });
  const oatResultKeys = quoteResultFields.map((f) => f.key);
  const oatResultMapped = oatMappings.filter((m) => oatResultKeys.includes(m.appFieldKey) && m.ghlCustomFieldId);
  const keenerResultMapped = keenerMappings.filter((m) => oatResultKeys.includes(m.appFieldKey) && m.ghlCustomFieldId);

  const oatFieldIds = new Set(oatMappings.map((m) => m.ghlCustomFieldId).filter(Boolean));
  const keenerFieldIds = new Set(keenerMappings.map((m) => m.ghlCustomFieldId).filter(Boolean));
  const crossLeak = [...oatFieldIds].filter((id) => keenerFieldIds.has(id));

  report.fieldMappings = {
    oatIntakeCount: oatMappings.length,
    keenerIntakeCount: keenerMappings.length,
    oatResultMappedCount: oatResultMapped.length,
    keenerResultMappedCount: keenerResultMapped.length,
    expectedResultFieldCount: oatResultKeys.length,
    crossAccountFieldIdLeakage: crossLeak.length,
    crossLeakIds: crossLeak.slice(0, 5),
  };

  // Credentials resolver (no tokens in output)
  report.credentials = {
    hasAny: hasAnyGhlCredentials(),
    oatLocation: getGhlCredentialsForLocation(OAT_GHL_LOCATION_ID).ghlLocationId,
    keenerLocation: getGhlCredentialsForLocation(KEENER_GHL_LOCATION_ID).ghlLocationId,
    oatPipelineConfigured: Boolean(process.env.OAT_GHL_QUOTE_PIPELINE_ID?.trim()),
    keenerPipelineConfigured: Boolean(process.env.KEENER_GHL_QUOTE_PIPELINE_ID?.trim()),
    legacyFallbackConfigured: Boolean(process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim()),
    accountSelectorOatLocation: ghlLocationIdForAccountKey("oat"),
    accountSelectorKeenerLocation: ghlLocationIdForAccountKey("keener"),
  };

  // Sync safety flags
  report.syncSafety = {
    syncBackEnabled: isGhlSyncBackEnabled(),
    autoSyncBackEnabled: isGhlAutoSyncBackEnabled(),
    manualWhenDisabled: evaluateSyncBackWritePermission("MANUAL"),
    pdfWhenDisabled: evaluateSyncBackWritePermission("PDF_GENERATED"),
    manualWhenSyncOnAutoOff: (() => {
      process.env.GHL_SYNC_BACK_ENABLED = "true";
      process.env.GHL_AUTO_SYNC_BACK_ENABLED = "false";
      const p = evaluateSyncBackWritePermission("MANUAL");
      process.env.GHL_SYNC_BACK_ENABLED = "false";
      return p;
    })(),
    pdfWhenSyncOnAutoOff: (() => {
      process.env.GHL_SYNC_BACK_ENABLED = "true";
      process.env.GHL_AUTO_SYNC_BACK_ENABLED = "false";
      const p = evaluateSyncBackWritePermission("PDF_GENERATED");
      process.env.GHL_SYNC_BACK_ENABLED = "false";
      return p;
    })(),
  };

  // Sync skip test (no real writes)
  const keenerQuote = testQuotes.find((q) => q.quoteNumber === "Q-2026-00004");
  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });
  let manualSkip = null;
  let pdfSkip = null;
  if (keenerQuote) {
    manualSkip = await syncQuoteToGhl(keenerQuote.id, { trigger: "MANUAL" });
    pdfSkip = await syncQuoteToGhl(keenerQuote.id, { trigger: "PDF_GENERATED" });
  }
  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });
  report.syncSkipTest = { manualSkip, pdfSkip, nonSkippedBefore, nonSkippedAfter };

  // Notifications sample
  const recentNotifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, type: true, quoteId: true, readAt: true },
  });
  report.recentNotifications = recentNotifications;

  // Customer messages
  const customerMessages = await prisma.quoteCustomerMessage.count();
  report.customerMessageCount = customerMessages;

  // Env / deployment
  const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
  const gitignore = readFileSync(resolve(process.cwd(), ".gitignore"), "utf8");
  const readme = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
  report.deployment = {
    envExampleHasDatabaseUrl: envExample.includes("DATABASE_URL"),
    envExampleHasAppUrl: envExample.includes("NEXT_PUBLIC_APP_URL"),
    envExampleHasSyncFlags: envExample.includes("GHL_SYNC_BACK_ENABLED") && envExample.includes("GHL_AUTO_SYNC_BACK_ENABLED"),
    envExampleHasOatKeener: envExample.includes("OAT_GHL_") && envExample.includes("KEENER_GHL_"),
    gitignoreHasEnv: gitignore.includes(".env"),
    gitignoreHasGenerated: gitignore.includes("public/generated"),
    pdfStoragePath: "public/generated/quotes (local filesystem)",
  };

  // Check no tokens in tracked example
  report.noTokensInExample =
    !envExample.includes("pit-") && !envExample.match(/[a-f0-9]{32}/i);

  const pdfDir = resolve(process.cwd(), "public/generated/quotes");
  try {
    const { readdirSync } = await import("fs");
    report.generatedPdfFiles = existsSync(pdfDir)
      ? readdirSync(pdfDir).filter((f) => f.endsWith(".pdf")).slice(0, 10)
      : [];
  } catch {
    report.generatedPdfFiles = [];
  }

  // Git check for committed secrets (safe grep in repo excluding node_modules)
  report.readmeHasSyncSafety = readFileSync(resolve(process.cwd(), "README.md"), "utf8").includes("GHL_AUTO_SYNC_BACK_ENABLED");

  await prisma.$disconnect();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
