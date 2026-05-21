/**
 * End-to-end Keener quote flow test (local only, no GHL writes).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient();
const BASE = process.env.TEST_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const QUOTE_ID = "cmpf0rpi90000mbgf39gw5iye";
const QUOTE_NUMBER = "Q-2026-00004";
const ACCEPT_TOKEN = "32a86daf-befa-4ee5-ace0-0072290d40f8";
const TEST_QUESTION = `Keener flow test question ${Date.now()}`;

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
  for (const url of [BASE, "http://localhost:3001", "http://localhost:3000"]) {
    try {
      const status = await fetch(`${url}/quotes/${QUOTE_ID}/edit`).then((r) => r.status);
      if (status === 200) return url;
    } catch {
      // try next
    }
  }
  throw new Error("Dev server not reachable on 3000 or 3001. Run: npm run dev");
}

async function getQuoteState() {
  return prisma.quote.findUnique({
    where: { id: QUOTE_ID },
    include: {
      company: true,
      customerSnapshot: true,
      vehicles: true,
      fees: true,
      customerMessages: { orderBy: { createdAt: "desc" }, take: 3 },
      ghlSyncLogs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
}

async function main() {
  const baseUrl = await resolveBaseUrl();
  console.log(`Using base URL: ${baseUrl}`);

  const before = await getQuoteState();
  if (!before) throw new Error("Quote not found.");
  const appToGhlBefore = await prisma.ghlSyncLog.count({
    where: { quoteId: QUOTE_ID, direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Edit page
  await page.goto(`${baseUrl}/quotes/${QUOTE_ID}/edit`);
  await page.waitForLoadState("networkidle");
  const editHtml = await page.content();
  const editHasKeener = editHtml.includes("Keener Logistics");
  const editHasIreland = editHtml.includes("Ireland McKay");
  const editHasPickup = editHtml.includes("765 Gold Creek Road");
  const editHasDelivery = editHtml.includes("984 Golf View Road");
  const quoteModeValue = await page.locator("#quoteMode").inputValue();

  // Pricing: enable broker fee + internal carrier pay, set deposit
  const brokerRow = page.locator('input[name="feeType_default-BROKER_FEE"]').locator("xpath=ancestor::div[contains(@class,'rounded-md')]");
  await brokerRow.locator('input[name="feeEnabled"]').check();
  await brokerRow.locator('input[name^="feeAmount_"]').fill("1200");
  await brokerRow.locator('input[name="feeShowOnPdf"]').check();

  const carrierRow = page.locator('input[name="feeType_default-CARRIER_PAY"]').locator("xpath=ancestor::div[contains(@class,'rounded-md')]");
  await carrierRow.locator('input[name="feeEnabled"]').check();
  await carrierRow.locator('input[name^="feeAmount_"]').fill("900");
  await carrierRow.locator('input[name="feeInternalOnly"]').check();
  await carrierRow.locator('input[name="feeShowOnPdf"]').uncheck();

  await page.locator("#depositDue").fill("300");
  await page.getByRole("button", { name: "Save quote" }).click();
  await page.waitForLoadState("networkidle");

  // Optional PDF generation
  await page.getByRole("button", { name: "Generate PDF (optional)" }).click();
  await page.waitForURL(/\/quotes\/.*\/preview/, { timeout: 120000 });
  const previewHtml = await page.content();
  const previewHasKeener = previewHtml.includes("Keener Logistics");
  const previewHasBroker = previewHtml.includes("Broker Fee");
  const previewHasCarrierPay = previewHtml.includes("Carrier Pay");
  const previewHasInternalNotes = previewHtml.includes("Internal notes");

  // Public accept page
  await page.goto(`${baseUrl}/accept/${ACCEPT_TOKEN}`);
  await page.waitForLoadState("networkidle");
  const acceptHtml = await page.content();
  const acceptHasKeener = acceptHtml.includes("Keener Logistics");
  const acceptHasOat = acceptHtml.includes("Organized Auto Transport");

  const viewPdfLink = page.getByRole("link", { name: "Download PDF copy (optional)" });
  const viewPdfVisible = await viewPdfLink.isVisible().catch(() => false);
  let viewPdfWorks = false;
  if (viewPdfVisible) {
    const href = await viewPdfLink.getAttribute("href");
    if (href) {
      const pdfStatus = await page.request.get(href.startsWith("http") ? href : `${baseUrl}${href}`).then((r) => r.status());
      viewPdfWorks = pdfStatus === 200;
    }
  }

  // Ask a question
  await page.locator("#message").fill(TEST_QUESTION);
  await page.getByRole("button", { name: "Send question" }).click();
  await page.waitForURL(/question=1/, { timeout: 30000 });
  const questionSubmitted = (await page.content()).includes("Question submitted");

  // Dashboard notification
  await page.goto(`${baseUrl}/`);
  await page.waitForLoadState("networkidle");
  const dashboardHtml = await page.content();
  const notificationVisible = dashboardHtml.includes(TEST_QUESTION) || dashboardHtml.includes("Customer question");

  // Edit page customer activity
  await page.goto(`${baseUrl}/quotes/${QUOTE_ID}/edit`);
  await page.waitForLoadState("networkidle");
  const activityHtml = await page.content();
  const activityHasQuestion = activityHtml.includes(TEST_QUESTION);

  await browser.close();

  const after = await getQuoteState();
  if (!after) throw new Error("Quote missing after test.");
  const appToGhlAfter = await prisma.ghlSyncLog.count({
    where: { quoteId: QUOTE_ID, direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });
  const appToGhlLogs = after.ghlSyncLogs.filter((log) => log.direction === "APP_TO_GHL");
  const oatMappings = await prisma.ghlFieldMapping.count({ where: { ghlLocationId: "iisYmOgIc6Ef6uoJ2sVx" } });

  console.log(
    JSON.stringify(
      {
        baseUrl,
        editPage: {
          showsKeener: editHasKeener,
          showsIrelandMcKay: editHasIreland,
          showsPickup: editHasPickup,
          showsDelivery: editHasDelivery,
          quoteModeSelect: quoteModeValue,
        },
        dbQuote: {
          companyName: after.company.name,
          companyId: after.companyId,
          quoteMode: after.quoteMode,
          ghlLocationId: after.ghlLocationId,
          customerTotal: after.customerTotal.toString(),
          depositDue: after.depositDue.toString(),
          balanceDue: after.balanceDue.toString(),
          quotePdfUrl: after.quotePdfUrl,
          vehicle: after.vehicles[0]
            ? {
                year: after.vehicles[0].year,
                isRunning: after.vehicles[0].isRunning,
                notesPresent: Boolean(after.vehicles[0].notes),
              }
            : null,
          fees: after.fees.map((fee) => ({
            type: fee.feeType,
            amount: fee.amount.toString(),
            enabled: fee.isEnabled,
            showOnPdf: fee.showOnPdf,
            internalOnly: fee.isInternalOnly,
          })),
        },
        pdf: {
          generated: Boolean(after.quotePdfUrl),
          previewShowsKeener: previewHasKeener,
          previewShowsBrokerFee: previewHasBroker,
          previewHidesCarrierPay: !previewHasCarrierPay,
          previewHidesInternalNotes: !previewHasInternalNotes,
        },
        publicPage: {
          showsKeener: acceptHasKeener,
          showsOat: acceptHasOat,
          viewPdfLinkVisible: viewPdfVisible,
          viewPdfWorks,
        },
        askQuestion: {
          submittedBanner: questionSubmitted,
          dashboardNotification: notificationVisible,
          editPageActivity: activityHasQuestion,
        },
        syncLogs: {
          appToGhlNonSkippedBefore: appToGhlBefore,
          appToGhlNonSkippedAfter: appToGhlAfter,
          recentAppToGhl: appToGhlLogs.map((log) => ({ status: log.status, errorMessage: log.errorMessage })),
          realGhlWriteOccurred: appToGhlAfter > appToGhlBefore,
        },
        oatMappingCount: oatMappings,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("TEST FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
