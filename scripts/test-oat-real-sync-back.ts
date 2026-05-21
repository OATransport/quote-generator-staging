/**
 * One-quote real OAT sync-back test.
 * Requires GHL_SYNC_BACK_ENABLED=true and active .env set to OAT credentials.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { syncQuoteToGhl } from "@/server/ghl-sync-back";
import { isGhlSyncBackEnabled } from "@/server/ghl";
import { OAT_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";

const OAT_TEST_QUOTE_NUMBER = "Q-2026-00003";

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

  if (process.env.GHL_LOCATION_ID?.trim() !== OAT_GHL_LOCATION_ID) {
    throw new Error("Active .env is not OAT. Copy OAT credentials into .env before running a real OAT sync test.");
  }
  if (!isGhlSyncBackEnabled()) {
    throw new Error("Refusing real sync test: set GHL_SYNC_BACK_ENABLED=true in .env or the shell environment.");
  }

  const prisma = new PrismaClient();
  const quote = await prisma.quote.findUnique({ where: { quoteNumber: OAT_TEST_QUOTE_NUMBER } });
  if (!quote) throw new Error(`Quote ${OAT_TEST_QUOTE_NUMBER} not found.`);

  console.log(`Running real sync-back for ${quote.quoteNumber} (${quote.id})`);
  console.log(`ghlOpportunityId=${quote.ghlOpportunityId}`);
  console.log(`ghlLocationId=${quote.ghlLocationId}`);

  const result = await syncQuoteToGhl(quote.id, { trigger: "MANUAL" });
  const log = await prisma.ghlSyncLog.findUnique({ where: { id: result.logId } });

  console.log(
    JSON.stringify(
      {
        status: result.status,
        message: result.message,
        logId: result.logId,
        requestSummary: {
          realWriteAllowed: (log?.requestPayload as { realWriteAllowed?: boolean } | null)?.realWriteAllowed,
          apiRequest: (log?.requestPayload as { apiRequest?: unknown } | null)?.apiRequest,
        },
        responseSummary: log?.responsePayload,
      },
      null,
      2,
    ),
  );

  if (result.status !== "SUCCESS") process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
