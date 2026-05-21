/**
 * Verify every APP_TO_GHL sync-back trigger creates a GhlSyncLog entry.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { syncQuoteToGhl } from "@/server/ghl-sync-back";

loadEnv();

const prisma = new PrismaClient();
const BASE = process.env.TEST_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const KEENER_QUOTE_ID = "cmpf0rpi90000mbgf39gw5iye";
const KEENER_TOKEN = "32a86daf-befa-4ee5-ace0-0072290d40f8";
const SAMPLE_QUOTE_NUMBER = "Q-SAMPLE-00001";
const SAMPLE_TOKEN = "test-accept-token";

const TRIGGERS = [
  "MANUAL",
  "PDF_GENERATED",
  "CUSTOMER_QUESTION",
  "CUSTOMER_DECLINED",
  "CUSTOMER_ACCEPTED",
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

async function resolveBaseUrl() {
  for (const url of [BASE, "http://localhost:3000", "http://localhost:3001"]) {
    try {
      if ((await fetch(`${url}/`).then((r) => r.status)) === 200) return url;
    } catch {
      // try next
    }
  }
  throw new Error("Dev server not running. Start with: npm run dev");
}

async function appToGhlCount(quoteId: string) {
  return prisma.ghlSyncLog.count({ where: { quoteId, direction: "APP_TO_GHL" } });
}

function triggerFromLog(log: { requestPayload: unknown } | null) {
  if (!log?.requestPayload || typeof log.requestPayload !== "object") return null;
  return (log.requestPayload as { trigger?: string }).trigger ?? null;
}

async function latestLog(quoteId: string) {
  return prisma.ghlSyncLog.findFirst({
    where: { quoteId, direction: "APP_TO_GHL" },
    orderBy: { createdAt: "desc" },
  });
}

async function waitForLogIncrease(quoteId: string, before: number, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await appToGhlCount(quoteId);
    if (count > before) return latestLog(quoteId);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  return latestLog(quoteId);
}

async function testDirectTriggers(quoteId: string) {
  const results: Array<{ trigger: string; pass: boolean; details: string }> = [];

  for (const trigger of TRIGGERS) {
    const before = await appToGhlCount(quoteId);
    const result = await syncQuoteToGhl(quoteId, { trigger });
    const after = await appToGhlCount(quoteId);
    const log = await latestLog(quoteId);
    const pass =
      after === before + 1 &&
      Boolean(result.logId) &&
      log?.status === "SKIPPED" &&
      log?.direction === "APP_TO_GHL" &&
      triggerFromLog(log) === trigger;

    results.push({
      trigger,
      pass,
      details: `count ${before}->${after}, logId=${result.logId || "missing"}, status=${log?.status}, trigger=${triggerFromLog(log)}`,
    });
  }

  return results;
}

async function getSampleQuoteId() {
  const quote = await prisma.quote.findUnique({ where: { quoteNumber: SAMPLE_QUOTE_NUMBER } });
  if (!quote) throw new Error("Sample quote not found. Run npm run prisma:seed");
  return quote.id;
}

async function main() {
  const baseUrl = await resolveBaseUrl();
  console.log(`Using base URL: ${baseUrl}`);

  const appToGhlNonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  console.log("\n=== Direct syncQuoteToGhl triggers (Keener Q-2026-00004) ===");
  const directResults = await testDirectTriggers(KEENER_QUOTE_ID);
  for (const row of directResults) {
    console.log(`${row.pass ? "PASS" : "FAIL"} — ${row.trigger}: ${row.details}`);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const integration: Array<{ name: string; pass: boolean; details: string }> = [];

  // PDF_GENERATED via action
  let before = await appToGhlCount(KEENER_QUOTE_ID);
  await page.goto(`${baseUrl}/quotes/${KEENER_QUOTE_ID}/edit`);
  await page.getByRole("button", { name: "Generate PDF (optional)" }).click();
  await page.waitForURL(/\/preview/, { timeout: 120000 });
  let log = await waitForLogIncrease(KEENER_QUOTE_ID, before, 120000);
  let after = await appToGhlCount(KEENER_QUOTE_ID);
  integration.push({
    name: "PDF_GENERATED (action)",
    pass: after === before + 1 && triggerFromLog(log) === "PDF_GENERATED" && log?.status === "SKIPPED",
    details: `count ${before}->${after}, trigger=${triggerFromLog(log)}, status=${log?.status}`,
  });

  // CUSTOMER_QUESTION via public page
  before = await appToGhlCount(KEENER_QUOTE_ID);
  const questionText = `Sync log reliability test ${Date.now()}`;
  await page.goto(`${baseUrl}/accept/${KEENER_TOKEN}`);
  await page.locator("#message").fill(questionText);
  await page.getByRole("button", { name: "Send question" }).click();
  await page.waitForURL(/question=1/, { timeout: 30000 });
  log = await waitForLogIncrease(KEENER_QUOTE_ID, before);
  after = await appToGhlCount(KEENER_QUOTE_ID);
  integration.push({
    name: "CUSTOMER_QUESTION (action)",
    pass: after === before + 1 && triggerFromLog(log) === "CUSTOMER_QUESTION" && log?.status === "SKIPPED",
    details: `count ${before}->${after}, trigger=${triggerFromLog(log)}, status=${log?.status}`,
  });

  // MANUAL via edit page
  before = await appToGhlCount(KEENER_QUOTE_ID);
  await page.goto(`${baseUrl}/quotes/${KEENER_QUOTE_ID}/edit`);
  await page.getByRole("button", { name: "Sync to GHL" }).click();
  await page.waitForURL(/syncStatus=/, { timeout: 30000 });
  log = await waitForLogIncrease(KEENER_QUOTE_ID, before);
  after = await appToGhlCount(KEENER_QUOTE_ID);
  integration.push({
    name: "MANUAL (action)",
    pass: after === before + 1 && triggerFromLog(log) === "MANUAL" && log?.status === "SKIPPED",
    details: `count ${before}->${after}, trigger=${triggerFromLog(log)}, status=${log?.status}`,
  });

  // Decline + Accept on sample quote (reseed so accept/decline forms are available)
  const { execSync } = await import("child_process");
  execSync("npm run prisma:seed", { stdio: "inherit", cwd: process.cwd() });
  const sampleQuoteId = await getSampleQuoteId();
  before = await appToGhlCount(sampleQuoteId);
  await page.goto(`${baseUrl}/accept/${SAMPLE_TOKEN}`);
  await page.locator('textarea[name="declineReason"]').fill("Sync log decline test.");
  await page.getByRole("button", { name: "Decline quote" }).click();
  await page.waitForURL(/declined=1/, { timeout: 30000 });
  log = await waitForLogIncrease(sampleQuoteId, before);
  after = await appToGhlCount(sampleQuoteId);
  integration.push({
    name: "CUSTOMER_DECLINED (action)",
    pass: after === before + 1 && triggerFromLog(log) === "CUSTOMER_DECLINED" && log?.status === "SKIPPED",
    details: `count ${before}->${after}, trigger=${triggerFromLog(log)}, status=${log?.status}`,
  });

  // Reseed sample for accept test
  execSync("npm run prisma:seed", { stdio: "inherit", cwd: process.cwd() });
  const refreshedSampleId = await getSampleQuoteId();
  before = await appToGhlCount(refreshedSampleId);
  await page.goto(`${baseUrl}/accept/${SAMPLE_TOKEN}`);
  await page.locator('input[name="customerSignature"]').fill("Jane Doe");
  await page.locator('input[name="agreeTerms"]').check();
  await page.getByRole("button", { name: "Accept quote" }).click();
  await page.waitForURL(/accepted=1/, { timeout: 30000 });
  log = await waitForLogIncrease(refreshedSampleId, before);
  after = await appToGhlCount(refreshedSampleId);
  integration.push({
    name: "CUSTOMER_ACCEPTED (action)",
    pass: after === before + 1 && triggerFromLog(log) === "CUSTOMER_ACCEPTED" && log?.status === "SKIPPED",
    details: `count ${before}->${after}, trigger=${triggerFromLog(log)}, status=${log?.status}`,
  });

  await browser.close();

  const appToGhlNonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  console.log("\n=== Integration triggers ===");
  for (const row of integration) {
    console.log(`${row.pass ? "PASS" : "FAIL"} — ${row.name}: ${row.details}`);
  }

  const all = [...directResults.map((r) => ({ name: `direct:${r.trigger}`, pass: r.pass })), ...integration];
  const failed = all.filter((r) => !r.pass);
  console.log(`\n${all.length - failed.length}/${all.length} checks passed`);
  console.log(
    JSON.stringify(
      {
        realGhlWriteOccurred: appToGhlNonSkippedAfter > appToGhlNonSkippedBefore,
        appToGhlNonSkippedBefore,
        appToGhlNonSkippedAfter,
      },
      null,
      2,
    ),
  );

  if (failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
