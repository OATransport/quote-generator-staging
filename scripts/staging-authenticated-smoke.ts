/**
 * Authenticated Vercel staging smoke test (uses local .env BASIC_AUTH_* — never commit).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const STAGING = "https://staging-app.shipwithoat.com";
const OAT_OPP = "orlebrOtaE52Uyy9WLjz";
const KEENER_OPP = "RFpzzOpWqlH2BDNC7kGj";
const OAT_LOCATION = "iisYmOgIc6Ef6uoJ2sVx";
const KEENER_LOCATION = "secdHfMuJKMfpDpHFMHw";

function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function fetchStatus(path: string, user: string, pass: string) {
  const res = await fetch(`${STAGING}${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` },
  });
  return res.status;
}

async function resetSample(p: PrismaClient, quoteId: string) {
  await p.quoteCustomerMessage.deleteMany({ where: { quoteId } });
  await p.notification.deleteMany({ where: { quoteId } });
  await p.quote.update({
    where: { id: quoteId },
    data: {
      status: "READY_TO_SEND",
      acceptedAt: null,
      declinedAt: null,
      declineReason: null,
      customerSignature: null,
      lastCustomerActionAt: null,
      acceptanceUrl: `${STAGING}/accept/test-accept-token`,
    },
  });
}

async function importOpportunity(page: import("playwright").Page, account: "oat" | "keener", oppId: string) {
  await page.goto(`${STAGING}/import?q=${oppId}&account=${account}`, { waitUntil: "networkidle" });
  const searchOk = (await page.content()).includes(oppId);
  const importBtn = page.locator("tr", { hasText: oppId }).getByRole("button", { name: "Import" });
  if (await importBtn.count()) {
    await importBtn.first().click();
    await page.waitForURL(/\/quotes\/.+\/edit/, { timeout: 90000 });
  } else {
    const existing = await page.goto(`${STAGING}/quotes`, { waitUntil: "networkidle" });
    void existing;
    const quotesHtml = await page.content();
    if (!quotesHtml.includes(oppId.slice(0, 8))) {
      throw new Error(`Opportunity ${oppId} not found and Import button missing.`);
    }
    await page.goto(`${STAGING}/import?q=${oppId}&account=${account}`, { waitUntil: "networkidle" });
  }
  const editHtml = await page.content();
  const liveLink = await page.locator("#liveQuoteLink").inputValue().catch(() => "");
  const quoteNumber = editHtml.match(/Q-[A-Z0-9-]+/)?.[0] ?? null;
  return { searchOk, quoteNumber, liveLink, editHtml };
}

async function main() {
  loadEnv();
  const user = process.env.BASIC_AUTH_USER?.trim();
  const pass = process.env.BASIC_AUTH_PASSWORD?.trim();
  if (!user || !pass) {
    throw new Error("BASIC_AUTH_USER and BASIC_AUTH_PASSWORD must be set in local .env (gitignored).");
  }

  const stagingDb = process.env.STAGING_DATABASE_URL?.trim();
  if (!stagingDb) {
    throw new Error("Set STAGING_DATABASE_URL in the shell when running this script.");
  }
  process.env.DATABASE_URL = stagingDb;
  const prisma = new PrismaClient();

  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const authRoutes = {
    root: await fetchStatus("/", user, pass),
    import: await fetchStatus("/import", user, pass),
    quotes: await fetchStatus("/quotes", user, pass),
  };
  if (authRoutes.root !== 200 || authRoutes.import !== 200 || authRoutes.quotes !== 200) {
    throw new Error(`Authenticated routes failed: ${JSON.stringify(authRoutes)}`);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ httpCredentials: { username: user, password: pass } }).then((c) => c.newPage());

  const oatImport = await importOpportunity(page, "oat", OAT_OPP);
  const oatDb = oatImport.quoteNumber
    ? await prisma.quote.findUnique({ where: { quoteNumber: oatImport.quoteNumber }, include: { company: true } })
    : null;

  const keenerImport = await importOpportunity(page, "keener", KEENER_OPP);
  const keenerDb = keenerImport.quoteNumber
    ? await prisma.quote.findUnique({ where: { quoteNumber: keenerImport.quoteNumber }, include: { company: true } })
    : null;

  const publicChecks: Record<string, unknown> = {};
  for (const [label, link] of [
    ["oat", oatImport.liveLink],
    ["keener", keenerImport.liveLink],
  ] as const) {
    if (!link) continue;
    const res = await fetch(link);
    const html = await res.text();
    publicChecks[label] = {
      status: res.status,
      complete: html.includes("Quote total") || html.includes("quote total"),
      noPdfRequired: !html.includes("PDF required"),
      branding: label === "oat" ? html.includes("/branding/oat") : html.includes("/branding/keener"),
    };
  }

  const sample = await prisma.quote.findUnique({ where: { quoteNumber: "Q-SAMPLE-00001" } });
  const customerActions: Record<string, unknown> = {};
  if (sample) {
    await resetSample(prisma, sample.id);
    await page.goto(`${STAGING}/accept/test-accept-token`, { waitUntil: "networkidle" });
    await page.locator("#customerSignature").fill("Auth Smoke Test");
    await page.locator('input[name="agreeTerms"]').check();
    await page.getByRole("button", { name: "Accept quote" }).click();
    await page.waitForTimeout(5000);
    customerActions.accept = (await prisma.quote.findUnique({ where: { id: sample.id } }))?.status === "ACCEPTED";

    await resetSample(prisma, sample.id);
    await page.goto(`${STAGING}/accept/test-accept-token`, { waitUntil: "networkidle" });
    await page.locator("#declineReason").fill("Auth smoke decline");
    await page.getByRole("button", { name: "Decline quote" }).click();
    await page.waitForTimeout(5000);
    customerActions.decline = (await prisma.quote.findUnique({ where: { id: sample.id } }))?.status === "DECLINED";

    await resetSample(prisma, sample.id);
    await page.goto(`${STAGING}/accept/test-accept-token`, { waitUntil: "networkidle" });
    await page.locator("#message").fill("Auth smoke question?");
    await page.getByRole("button", { name: "Send question" }).click();
    await page.waitForTimeout(5000);
    customerActions.question = (await prisma.quoteCustomerMessage.count({ where: { quoteId: sample.id } })) > 0;

    await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
    customerActions.customerActivity = /Customer activity/i.test(await page.content());
    await page.getByRole("button", { name: /Sync to GHL/i }).click();
    await page.waitForTimeout(5000);
    const syncLog = await prisma.ghlSyncLog.findFirst({
      where: { quoteId: sample.id, direction: "APP_TO_GHL" },
      orderBy: { createdAt: "desc" },
    });
    customerActions.manualSyncStatus = syncLog?.status ?? "none";
    customerActions.syncUiSkipped = /SKIPPED|skipped|disabled|not enabled/i.test(await page.content());

    await page.goto(`${STAGING}/`, { waitUntil: "networkidle" });
    customerActions.dashboardNotifications = (await page.content()).includes("Recent notifications");
  }

  await browser.close();

  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  console.log(
    JSON.stringify(
      {
        authRoutes,
        oat: {
          searchOk: oatImport.searchOk,
          quoteNumber: oatImport.quoteNumber,
          liveQuoteUrl: oatImport.liveLink,
          liveLinkOk: oatImport.liveLink.startsWith(`${STAGING}/accept/`),
          company: oatDb?.company.name,
          quoteMode: oatDb?.quoteMode,
          ghlLocationId: oatDb?.ghlLocationId,
          branding: oatImport.editHtml.includes("/branding/oat"),
        },
        keener: {
          searchOk: keenerImport.searchOk,
          quoteNumber: keenerImport.quoteNumber,
          liveQuoteUrl: keenerImport.liveLink,
          liveLinkOk: keenerImport.liveLink.startsWith(`${STAGING}/accept/`),
          company: keenerDb?.company.name,
          quoteMode: keenerDb?.quoteMode,
          ghlLocationId: keenerDb?.ghlLocationId,
          branding: keenerImport.editHtml.includes("/branding/keener"),
        },
        publicChecks,
        customerActions,
        syncSafety: {
          nonSkippedBefore,
          nonSkippedAfter,
          anyRealWrite: nonSkippedAfter > nonSkippedBefore,
          counts: await prisma.ghlSyncLog.groupBy({ by: ["status"], where: { direction: "APP_TO_GHL" }, _count: true }),
        },
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
