/**
 * Verify Accept/Decline notifications via public accept page (no real GHL writes).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const SAMPLE_TOKEN = "test-accept-token";
const SAMPLE_QUOTE_NUMBER = "Q-SAMPLE-00001";

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

async function resetSampleQuote(prisma: PrismaClient) {
  await prisma.quote.update({
    where: { quoteNumber: SAMPLE_QUOTE_NUMBER },
    data: {
      status: "READY_TO_SEND",
      acceptedAt: null,
      declinedAt: null,
      declineReason: null,
      customerSignature: null,
      acceptedIp: null,
      acceptedUserAgent: null,
      declinedIp: null,
      declinedUserAgent: null,
      lastCustomerActionAt: null,
    },
  });
}

async function resolveBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
  ];
  for (const url of candidates) {
    try {
      if ((await fetch(`${url}/`).then((r) => r.status)) === 200) return url;
    } catch {
      // try next
    }
  }
  throw new Error("Dev server not running. Start with: npm run dev");
}

async function main() {
  loadEnv();
  process.env.GHL_SYNC_BACK_ENABLED = "false";
  process.env.GHL_AUTO_SYNC_BACK_ENABLED = "false";

  const base = await resolveBaseUrl();
  const prisma = new PrismaClient();
  const quote = await prisma.quote.findUnique({ where: { quoteNumber: SAMPLE_QUOTE_NUMBER } });
  if (!quote) throw new Error(`Sample quote ${SAMPLE_QUOTE_NUMBER} not found.`);

  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Accept
  await resetSampleQuote(prisma);
  await page.goto(`${base}/accept/${SAMPLE_TOKEN}`);
  await page.getByLabel("Your full name (signature)").fill("Staging Verify Customer");
  await page.getByRole("checkbox", { name: /I agree to the quote terms/i }).check();
  await page.getByRole("button", { name: "Accept quote" }).click();
  await page.waitForURL(/accepted=1/);

  const acceptNotification = await prisma.notification.findFirst({
    where: { quoteId: quote.id, type: "QUOTE_ACCEPTED" },
    orderBy: { createdAt: "desc" },
  });

  // Decline
  await resetSampleQuote(prisma);
  await page.goto(`${base}/accept/${SAMPLE_TOKEN}`);
  await page.getByLabel("Reason for declining").fill("Staging verification — test decline only.");
  await page.getByRole("button", { name: "Decline quote" }).click();
  await page.waitForURL(/declined=1/);

  const declineNotification = await prisma.notification.findFirst({
    where: { quoteId: quote.id, type: "QUOTE_DECLINED" },
    orderBy: { createdAt: "desc" },
  });

  await browser.close();

  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  await resetSampleQuote(prisma);
  await prisma.$disconnect();

  const result = {
    base,
    acceptNotificationCreated: Boolean(acceptNotification),
    acceptNotification: acceptNotification
      ? { id: acceptNotification.id, type: acceptNotification.type, message: acceptNotification.message }
      : null,
    declineNotificationCreated: Boolean(declineNotification),
    declineNotification: declineNotification
      ? { id: declineNotification.id, type: declineNotification.type, message: declineNotification.message }
      : null,
    nonSkippedBefore,
    nonSkippedAfter,
    anyRealGhlWrite: nonSkippedAfter > nonSkippedBefore,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.acceptNotificationCreated || !result.declineNotificationCreated) {
    throw new Error("Accept or decline notification was not created.");
  }
  if (result.anyRealGhlWrite) {
    throw new Error("Real GHL write detected during notification verification.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
