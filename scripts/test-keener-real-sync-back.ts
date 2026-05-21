/**
 * One-quote real Keener sync-back test with GHL read-back verification.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { syncQuoteToGhl } from "@/server/ghl-sync-back";
import { getGhlOpportunity } from "@/server/ghl";
import { KEENER_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";
import { appUrl } from "@/lib/utils";

const QUOTE_NUMBER = "Q-2026-00004";
const FIELD_KEYS = [
  "quoteNumber",
  "quoteMode",
  "quoteStatus",
  "quoteTotal",
  "depositDue",
  "balanceDue",
  "quotePdfUrl",
  "quoteAcceptanceUrl",
  "latestCustomerQuestion",
  "acceptedAt",
  "declinedAt",
  "declineReason",
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

function absoluteUrl(path?: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : appUrl(path);
}

function readGhlFieldValue(field: { field_value?: unknown; fieldValue?: unknown; value?: unknown }) {
  return field.field_value ?? field.fieldValue ?? field.value ?? null;
}

async function main() {
  loadEnv();
  process.env.GHL_SYNC_BACK_ENABLED = "true";

  if (process.env.GHL_LOCATION_ID?.trim() !== KEENER_GHL_LOCATION_ID) {
    throw new Error("Active .env is not Keener.");
  }

  const prisma = new PrismaClient();
  const quote = await prisma.quote.findUnique({
    where: { quoteNumber: QUOTE_NUMBER },
    include: { company: true, customerMessages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!quote?.ghlOpportunityId) throw new Error(`Quote ${QUOTE_NUMBER} not found or missing ghlOpportunityId.`);

  const mappings = await prisma.ghlFieldMapping.findMany({
    where: { ghlLocationId: KEENER_GHL_LOCATION_ID, appFieldKey: { in: [...FIELD_KEYS] } },
  });

  const latestQuestion = quote.customerMessages[0];
  const expected: Record<string, string | null> = {
    quoteNumber: quote.quoteNumber,
    quoteMode: quote.quoteMode,
    quoteStatus: quote.status,
    quoteTotal: quote.customerTotal.toString(),
    depositDue: quote.depositDue.toString(),
    balanceDue: quote.balanceDue.toString(),
    quotePdfUrl: absoluteUrl(quote.quotePdfUrl),
    quoteAcceptanceUrl: quote.acceptanceUrl ?? appUrl(`/accept/${quote.secureAccessToken}`),
    latestCustomerQuestion: latestQuestion ? `${latestQuestion.customerName}: ${latestQuestion.message}` : null,
    acceptedAt: quote.acceptedAt?.toISOString() ?? null,
    declinedAt: quote.declinedAt?.toISOString() ?? null,
    declineReason: quote.declineReason ?? null,
  };

  const beforeOpp = await getGhlOpportunity(quote.ghlOpportunityId, quote.ghlLocationId ?? undefined);
  const result = await syncQuoteToGhl(quote.id, { trigger: "MANUAL" });
  const log = await prisma.ghlSyncLog.findUnique({ where: { id: result.logId } });
  const afterOpp = await getGhlOpportunity(quote.ghlOpportunityId, quote.ghlLocationId ?? undefined);

  const toWrite = FIELD_KEYS.filter((key) => expected[key]);
  const skippedNoValue = FIELD_KEYS.filter((key) => !expected[key]);
  const readback: Array<{ key: string; expected: string; actual: string | null; match: boolean }> = [];
  const confirmed: string[] = [];
  const mismatches: string[] = [];

  for (const key of toWrite) {
    const mapping = mappings.find((row) => row.appFieldKey === key);
    const ghlField = afterOpp.customFields?.find(
      (field) => (field as { id?: string }).id === mapping?.ghlCustomFieldId,
    );
    const actual = readGhlFieldValue(ghlField ?? {});
    const actualText = actual == null ? null : String(actual);
    const match = actualText === expected[key];
    readback.push({ key, expected: expected[key]!, actual: actualText, match });
    if (match) confirmed.push(key);
    else mismatches.push(key);
  }

  console.log(
    JSON.stringify(
      {
        activeEnvKeener: true,
        quoteMeta: {
          company: quote.company.name,
          quoteMode: quote.quoteMode,
          ghlLocationId: quote.ghlLocationId,
          ghlOpportunityId: quote.ghlOpportunityId,
        },
        mappingCount: mappings.filter((row) => row.ghlCustomFieldId).length,
        sync: {
          status: result.status,
          message: result.message,
          logId: result.logId,
          logStatus: log?.status,
          direction: log?.direction,
        },
        opportunityUpdated: quote.ghlOpportunityId,
        written: toWrite,
        skippedNoValue,
        readback,
        confirmed,
        mismatches,
        stageUnchanged: beforeOpp.pipelineStageId === afterOpp.pipelineStageId,
        statusUnchanged: (beforeOpp as { status?: string }).status === (afterOpp as { status?: string }).status,
        monetaryValueUnchanged: beforeOpp.monetaryValue === afterOpp.monetaryValue,
      },
      null,
      2,
    ),
  );

  if (result.status !== "SUCCESS" || mismatches.length) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
