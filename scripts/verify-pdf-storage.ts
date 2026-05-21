/**
 * Optional: verify PDF storage mode and local fallback generation (no real GHL writes).
 */
import { readFileSync, statSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { generateQuotePdf, getPdfStorageMode } from "@/lib/pdf";

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
  const blobTokenConfiguredBeforeClear = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.GHL_SYNC_BACK_ENABLED = "false";
  process.env.GHL_AUTO_SYNC_BACK_ENABLED = "false";

  const prisma = new PrismaClient();
  const mode = getPdfStorageMode();
  if (mode !== "local") {
    throw new Error(`Expected local storage mode without BLOB_READ_WRITE_TOKEN, got ${mode}`);
  }

  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const tests = [
    { quoteNumber: "Q-2026-00003", label: "OAT" },
    { quoteNumber: "Q-2026-00004", label: "Keener" },
  ] as const;

  const results = [];

  for (const test of tests) {
    const quote = await prisma.quote.findUnique({
      where: { quoteNumber: test.quoteNumber },
      include: { company: true, customerSnapshot: true, fees: true, vehicles: true },
    });
    if (!quote) throw new Error(`Quote not found: ${test.quoteNumber}`);

    const pdfUrl = await generateQuotePdf(quote);
    const isLocalPath = pdfUrl.startsWith("/generated/quotes/");
    const localFileExists = isLocalPath && statSync(resolve(process.cwd(), "public", pdfUrl.replace(/^\//, ""))).size > 0;

    await prisma.quote.update({
      where: { id: quote.id },
      data: { quotePdfUrl: pdfUrl },
    });

    results.push({
      label: test.label,
      quoteNumber: test.quoteNumber,
      storageMode: mode,
      pdfUrl,
      isLocalPath,
      localFileExists,
    });
  }

  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  await prisma.$disconnect();

  const summary = {
    storageMode: mode,
    blobTokenConfigured: blobTokenConfiguredBeforeClear,
    results,
    nonSkippedBefore,
    nonSkippedAfter,
    anyRealGhlWrite: nonSkippedAfter > nonSkippedBefore,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (summary.anyRealGhlWrite) throw new Error("Real GHL write detected during PDF verification.");
  if (!results.every((row) => row.isLocalPath && row.localFileExists)) {
    throw new Error("Local PDF generation did not produce expected files.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
