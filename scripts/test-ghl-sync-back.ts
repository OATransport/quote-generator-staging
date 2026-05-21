import { execSync } from "child_process";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
const SAMPLE_QUOTE_NUMBER = "Q-SAMPLE-00001";
const SAMPLE_TOKEN = "test-accept-token";

type Check = { name: string; pass: boolean; details: string };
const results: Check[] = [];

function record(name: string, pass: boolean, details: string) {
  results.push({ name, pass, details });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}: ${details}`);
}

async function getQuoteId() {
  const quote = await prisma.quote.findUnique({ where: { quoteNumber: SAMPLE_QUOTE_NUMBER } });
  if (!quote) throw new Error("Sample quote not found.");
  return quote.id;
}

async function syncLogCount(quoteId: string) {
  return prisma.ghlSyncLog.count({ where: { quoteId, direction: "APP_TO_GHL" } });
}

async function latestSyncLog(quoteId: string) {
  return prisma.ghlSyncLog.findFirst({
    where: { quoteId, direction: "APP_TO_GHL" },
    orderBy: { createdAt: "desc" },
  });
}

function triggerFromLog(log: { requestPayload: unknown } | null) {
  if (!log?.requestPayload || typeof log.requestPayload !== "object") return null;
  return (log.requestPayload as { trigger?: string }).trigger ?? null;
}

async function waitForSyncLogIncrease(quoteId: string, before: number, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await syncLogCount(quoteId);
    if (count > before) return latestSyncLog(quoteId);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return latestSyncLog(quoteId);
}

async function reseed() {
  execSync("npm run prisma:seed", { stdio: "inherit", cwd: process.cwd() });
}

async function main() {
  const mockToken = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  if (mockToken) throw new Error("GHL_PRIVATE_INTEGRATION_TOKEN is set — aborting.");
  record("Mock mode", !mockToken, "GHL_PRIVATE_INTEGRATION_TOKEN is empty");

  const health = await fetch(BASE).then((r) => r.status).catch(() => 0);
  if (health !== 200) throw new Error(`Dev server not reachable at ${BASE} (status ${health})`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let quoteId = await getQuoteId();

  // A. Manual sync
  const beforeManual = await syncLogCount(quoteId);
  await page.goto(`${BASE}/quotes/${quoteId}/edit`);
  await page.getByRole("button", { name: "Sync to GHL" }).click();
  const manualLog = await waitForSyncLogIncrease(quoteId, beforeManual);
  await page.goto(`${BASE}/quotes/${quoteId}/edit?syncStatus=SKIPPED&syncMessage=${encodeURIComponent("Mock GHL mode")}`);
  const manualHtml = await page.content();
  const afterManual = await syncLogCount(quoteId);
  record(
    "A. Manual sync log",
    afterManual === beforeManual + 1 && manualLog?.status === "SKIPPED" && manualLog.direction === "APP_TO_GHL" && triggerFromLog(manualLog) === "MANUAL",
    `count ${beforeManual}->${afterManual}, status=${manualLog?.status}, trigger=${triggerFromLog(manualLog)}`,
  );
  record(
    "A. GHL Sync card UI",
    manualHtml.includes("GHL Sync") && manualHtml.includes("SKIPPED") && manualHtml.includes("APP_TO_GHL"),
    "edit page shows GHL Sync card with SKIPPED",
  );

  // B. PDF generation
  quoteId = await getQuoteId();
  const beforePdf = await syncLogCount(quoteId);
  await page.goto(`${BASE}/quotes/${quoteId}/edit`);
  await page.getByRole("button", { name: "Generate PDF (optional)" }).click();
  await page.waitForURL(/\/preview/, { timeout: 120000 });
  const pdfLog = await waitForSyncLogIncrease(quoteId, beforePdf, 120000);
  const afterPdf = await syncLogCount(quoteId);
  record(
    "B. PDF generation sync",
    afterPdf === beforePdf + 1 && pdfLog?.status === "SKIPPED" && triggerFromLog(pdfLog) === "PDF_GENERATED",
    `count ${beforePdf}->${afterPdf}, status=${pdfLog?.status}, trigger=${triggerFromLog(pdfLog)}`,
  );

  // C. Ask question
  quoteId = await getQuoteId();
  const beforeQuestion = await syncLogCount(quoteId);
  const beforeQuestionNotifs = await prisma.notification.count({ where: { quoteId, type: "QUOTE_QUESTION" } });
  await page.goto(`${BASE}/accept/${SAMPLE_TOKEN}`);
  await page.locator('input[name="customerName"]').fill("Test Customer");
  await page.locator('textarea[name="message"]').fill("What is the pickup window?");
  await page.getByRole("button", { name: "Send question" }).click();
  await page.waitForURL(/question=1/, { timeout: 60000 });
  const questionLog = await waitForSyncLogIncrease(quoteId, beforeQuestion);
  const afterQuestion = await syncLogCount(quoteId);
  const afterQuestionNotifs = await prisma.notification.count({ where: { quoteId, type: "QUOTE_QUESTION" } });
  record(
    "C. Ask Question sync",
    afterQuestion === beforeQuestion + 1 && questionLog?.status === "SKIPPED" && triggerFromLog(questionLog) === "CUSTOMER_QUESTION",
    `count ${beforeQuestion}->${afterQuestion}, status=${questionLog?.status}, trigger=${triggerFromLog(questionLog)}`,
  );
  record(
    "C. Ask Question notification",
    afterQuestionNotifs === beforeQuestionNotifs + 1,
    `notifications ${beforeQuestionNotifs}->${afterQuestionNotifs}`,
  );

  // D. Decline
  console.log("Re-seeding before decline test...");
  await reseed();
  quoteId = await getQuoteId();
  const beforeDecline = await syncLogCount(quoteId);
  const beforeDeclineNotifs = await prisma.notification.count({ where: { quoteId, type: "QUOTE_DECLINED" } });
  await page.goto(`${BASE}/accept/${SAMPLE_TOKEN}`);
  await page.locator('textarea[name="declineReason"]').fill("Found another carrier.");
  await page.getByRole("button", { name: "Decline quote" }).click();
  await page.waitForURL(/declined=1/, { timeout: 60000 });
  const declineLog = await waitForSyncLogIncrease(quoteId, beforeDecline);
  const afterDecline = await syncLogCount(quoteId);
  const afterDeclineNotifs = await prisma.notification.count({ where: { quoteId, type: "QUOTE_DECLINED" } });
  record(
    "D. Decline sync",
    afterDecline === beforeDecline + 1 && declineLog?.status === "SKIPPED" && triggerFromLog(declineLog) === "CUSTOMER_DECLINED",
    `count ${beforeDecline}->${afterDecline}, status=${declineLog?.status}, trigger=${triggerFromLog(declineLog)}`,
  );
  record(
    "D. Decline notification",
    afterDeclineNotifs === beforeDeclineNotifs + 1,
    `notifications ${beforeDeclineNotifs}->${afterDeclineNotifs}`,
  );

  // E. Accept
  console.log("Re-seeding before accept test...");
  await reseed();
  quoteId = await getQuoteId();
  const beforeAccept = await syncLogCount(quoteId);
  const beforeAcceptNotifs = await prisma.notification.count({ where: { quoteId, type: "QUOTE_ACCEPTED" } });
  await page.goto(`${BASE}/accept/${SAMPLE_TOKEN}`);
  await page.locator('input[name="customerSignature"]').fill("Jane Doe");
  await page.locator('input[name="agreeTerms"]').check();
  await page.getByRole("button", { name: "Accept quote" }).click();
  await page.waitForURL(/accepted=1/, { timeout: 60000 });
  const acceptLog = await waitForSyncLogIncrease(quoteId, beforeAccept);
  const afterAccept = await syncLogCount(quoteId);
  const afterAcceptNotifs = await prisma.notification.count({ where: { quoteId, type: "QUOTE_ACCEPTED" } });
  record(
    "E. Accept sync",
    afterAccept === beforeAccept + 1 && acceptLog?.status === "SKIPPED" && triggerFromLog(acceptLog) === "CUSTOMER_ACCEPTED",
    `count ${beforeAccept}->${afterAccept}, status=${acceptLog?.status}, trigger=${triggerFromLog(acceptLog)}`,
  );
  record(
    "E. Accept notification",
    afterAcceptNotifs === beforeAcceptNotifs + 1,
    `notifications ${beforeAcceptNotifs}->${afterAcceptNotifs}`,
  );

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
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
