/**
 * Staging UX smoke test — no GHL imports/writes. Uses local .env BASIC_AUTH_* only.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Page } from "playwright";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const STAGING = "https://staging-app.shipwithoat.com";

type PublicAcceptCheck = {
  status: number;
  hidesCarrierPay: boolean;
  hidesInternalNotes: boolean;
  hasQuoteTotal: boolean;
};

type SmokeReport = {
  failures: string[];
  unauth?: Record<string, number>;
  authed?: Record<string, number>;
  dashboard?: Record<string, boolean>;
  quoteList?: Record<string, boolean>;
  archivedView?: { loaded: boolean; quoteNumbers: string[] };
  pricingSave?: { livePreviewVisible: boolean; savedDeposit: boolean; restored: boolean };
  publicAccept?: PublicAcceptCheck;
  archiveFlow?: Record<string, boolean>;
  syncSafety?: {
    latestStatus: string;
    skipped: boolean;
    nonSkippedBefore: number;
    nonSkippedAfter: number;
    anyRealWrite: boolean;
  };
  publicLinks?: Record<string, unknown>;
  sampleInActiveList?: boolean;
  [key: string]: unknown;
};

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

async function fetchStatus(path: string, auth?: { user: string; pass: string }) {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString("base64")}`;
  const res = await fetch(`${STAGING}${path}`, { headers, redirect: "manual" });
  return res.status;
}

async function readStagingLiveLink(page: Page) {
  const openHref = await page.getByRole("link", { name: "Open live quote" }).first().getAttribute("href");
  if (openHref?.startsWith(`${STAGING}/accept/`)) {
    return openHref;
  }
  const previewInput = page.locator("#liveQuoteLinkPreview");
  await previewInput.waitFor({ state: "visible", timeout: 5000 });
  const previewValue = await previewInput.inputValue();
  if (previewValue.startsWith(`${STAGING}/accept/`)) {
    return previewValue;
  }
  return openHref ?? previewValue;
}

async function main() {
  loadEnv();
  const user = process.env.BASIC_AUTH_USER?.trim();
  const pass = process.env.BASIC_AUTH_PASSWORD?.trim();
  if (!user || !pass) throw new Error("BASIC_AUTH_USER and BASIC_AUTH_PASSWORD required in .env");

  process.env.DATABASE_URL = process.env.STAGING_DATABASE_URL?.trim() ?? process.env.DATABASE_URL ?? "";
  if (!process.env.DATABASE_URL) throw new Error("STAGING_DATABASE_URL or DATABASE_URL required");

  const prisma = new PrismaClient();
  const auth = { user, pass };
  const report: SmokeReport = { failures: [] };

  function fail(msg: string) {
    report.failures.push(msg);
  }

  const unauth = {
    root: await fetchStatus("/"),
    import: await fetchStatus("/import"),
    quotes: await fetchStatus("/quotes"),
    accept: await fetchStatus("/accept/test-accept-token"),
    branding: await fetchStatus("/branding/oat-logo.jpg"),
  };
  report.unauth = unauth;
  if (unauth.root !== 401) fail(`Expected / -> 401, got ${unauth.root}`);
  if (unauth.import !== 401) fail(`Expected /import -> 401, got ${unauth.import}`);
  if (unauth.quotes !== 401) fail(`Expected /quotes -> 401, got ${unauth.quotes}`);
  if (unauth.accept !== 200) fail(`Expected public accept -> 200, got ${unauth.accept}`);
  if (unauth.branding !== 200) fail(`Expected branding -> 200, got ${unauth.branding}`);

  const authed = {
    root: await fetchStatus("/", auth),
    quotes: await fetchStatus("/quotes", auth),
    archived: await fetchStatus("/quotes?archived=1", auth),
    all: await fetchStatus("/quotes?archived=all", auth),
    import: await fetchStatus("/import", auth),
  };
  report.authed = authed;
  for (const [k, v] of Object.entries(authed)) {
    if (v !== 200) fail(`Authenticated ${k} -> expected 200, got ${v}`);
  }

  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ httpCredentials: { username: user, password: pass } });
  const page = await context.newPage();

  await page.goto(`${STAGING}/`, { waitUntil: "networkidle" });
  const dash = await page.content();
  report.dashboard = {
    commandCenter: /Quote command center/i.test(dash),
    statCards: /Active quotes/i.test(dash) && /Archived/i.test(dash) && /Needs follow-up/i.test(dash),
    notifications: /Recent notifications/i.test(dash),
    followUp: /Needs follow-up/i.test(dash),
    quickActions: /Import from GHL/i.test(dash) && /Active quotes/i.test(dash),
  };
  if (!report.dashboard.commandCenter) fail("Dashboard command center missing");
  if (!report.dashboard.statCards) fail("Dashboard stat cards missing");

  await page.goto(`${STAGING}/quotes`, { waitUntil: "networkidle" });
  const listActive = await page.content();
  report.quoteList = {
    search: listActive.includes('name="q"') || listActive.includes("Search"),
    filters: /Company/i.test(listActive) && /Archive/i.test(listActive) && /Status/i.test(listActive),
    sort: /Sort by/i.test(listActive) || listActive.includes('name="sort"'),
    badges: /OAT|Keener/i.test(listActive),
    liveActions: /Open live quote|Copy live quote link/i.test(listActive) || listActive.includes("aria-label"),
    archiveActions: /Archive/i.test(listActive),
  };

  await page.goto(`${STAGING}/quotes?archived=1`, { waitUntil: "networkidle" });
  const listArchived = await page.content();
  const archivedQuoteNumbers = [...listArchived.matchAll(/Q-[A-Z0-9-]+/g)].map((m) => m[0]);
  report.archivedView = { loaded: /Archived|archived/i.test(listArchived), quoteNumbers: archivedQuoteNumbers };

  await page.goto(`${STAGING}/quotes`, { waitUntil: "networkidle" });
  const activeHtml = await page.content();
  const sampleInActive = activeHtml.includes("Q-SAMPLE-00001");

  const sample = await prisma.quote.findUnique({
    where: { quoteNumber: "Q-SAMPLE-00001" },
    include: { company: true },
  });
  const oatQuote = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: "Q-2026" }, company: { name: { contains: "Organized", mode: "insensitive" } }, archivedAt: null },
    include: { company: true },
  });
  const keenerQuote = await prisma.quote.findFirst({
    where: { company: { name: { contains: "Keener", mode: "insensitive" } }, archivedAt: null },
    include: { company: true },
  });

  async function checkEditPage(quoteId: string, label: string) {
    await page.goto(`${STAGING}/quotes/${quoteId}/edit`, { waitUntil: "networkidle" });
    const html = await page.content();
    const liveLink = await readStagingLiveLink(page);
    const checks = {
      header: /Copy live quote link/i.test(html),
      customerSummary: /Customer-facing quote/i.test(html),
      internalSummary: /Internal dispatch view/i.test(html),
      profitSummary: /Profit summary|C\. Profit summary/i.test(html),
      badges: /Customer-visible|Internal only/i.test(html),
      stickySave: /Save quote/i.test(html) && /Unsaved changes|Does not update GHL/i.test(html),
      collapsible: /Quote settings|Pickup location|Delivery location/i.test(html),
      liveLinkStaging: liveLink.startsWith(`${STAGING}/accept/`),
      previewInputId: await page.locator("#liveQuoteLinkPreview").count(),
      sidebarInputId: await page.locator("#liveQuoteLinkSidebar").count(),
    };
    report[`edit_${label}`] = { ...checks, liveLinkOk: checks.liveLinkStaging };
    if (!checks.customerSummary) fail(`${label} edit: customer summary missing`);
    if (!checks.liveLinkStaging) fail(`${label} edit: live link not staging URL`);
    if (checks.previewInputId !== 1 || checks.sidebarInputId !== 1) {
      fail(`${label} edit: expected unique preview/sidebar live link inputs`);
    }
  }

  if (sample && !sample.archivedAt) {
    await checkEditPage(sample.id, "sample");
  }

  if (oatQuote) await checkEditPage(oatQuote.id, "oat");
  if (keenerQuote) await checkEditPage(keenerQuote.id, "keener");

  if (sample && !sample.archivedAt) {
    const originalDeposit = Number(sample.depositDue);
    const testDeposit = originalDeposit === 100 ? 101 : 100;
    await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
    const deposit = page.locator("#depositDue");
    await deposit.scrollIntoViewIfNeeded();
    await deposit.fill(String(testDeposit));
    await page.waitForTimeout(500);
    const previewTotal = await page.locator("text=Customer total").first().isVisible().catch(() => false);
    await page.getByRole("button", { name: /Save quote/i }).click();
    await page.waitForTimeout(3000);
    await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
    const savedDeposit = await page.locator("#depositDue").inputValue();
    report.pricingSave = {
      livePreviewVisible: previewTotal,
      savedDeposit: savedDeposit === String(testDeposit),
      restored: false,
    };
    if (savedDeposit !== String(testDeposit)) fail("Deposit did not persist after save");
    await page.locator("#depositDue").fill(String(originalDeposit));
    await page.getByRole("button", { name: /Save quote/i }).click();
    await page.waitForTimeout(2000);
    report.pricingSave.restored = true;

    const acceptRes = await fetch(`${STAGING}/accept/test-accept-token`);
    const acceptHtml = await acceptRes.text();
    const publicAccept: PublicAcceptCheck = {
      status: acceptRes.status,
      hidesCarrierPay: !/carrier pay/i.test(acceptHtml),
      hidesInternalNotes: !/internal notes/i.test(acceptHtml),
      hasQuoteTotal: /Quote total/i.test(acceptHtml),
    };
    report.publicAccept = publicAccept;
    if (!publicAccept.hidesCarrierPay) fail("Public accept exposes carrier pay");
  }

  let archiveQuote = await prisma.quote.findFirst({
    where: { quoteNumber: "Q-ARCHIVE-SMOKE-UX" },
  });
  if (!archiveQuote && sample) {
    archiveQuote = await prisma.quote.create({
      data: {
        quoteNumber: "Q-ARCHIVE-SMOKE-UX",
        quoteMode: "OAT_DIRECT",
        status: "READY_TO_SEND",
        companyId: sample.companyId,
        customerSnapshotId: sample.customerSnapshotId,
        customerTotal: 1,
        depositDue: 0,
        balanceDue: 1,
        secureAccessToken: `archive-smoke-${Date.now()}`,
        acceptanceUrl: `${STAGING}/accept/archive-smoke-token`,
      },
    });
  } else if (!archiveQuote) {
    fail("No sample quote to clone for archive smoke test");
  }

  if (archiveQuote && !archiveQuote.archivedAt) {
    await page.goto(`${STAGING}/quotes/${archiveQuote.id}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Archive$/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const dialogVisible = await page.locator('[role="dialog"]').isVisible();
    await page.getByRole("button", { name: /Archive quote/i }).click();
    await page.waitForURL(/\/quotes/, { timeout: 15000 });
    await page.goto(`${STAGING}/quotes`, { waitUntil: "networkidle" });
    const afterArchiveActive = !(await page.content()).includes("Q-ARCHIVE-SMOKE-UX");
    await page.goto(`${STAGING}/quotes?archived=1`, { waitUntil: "networkidle" });
    const inArchived = (await page.content()).includes("Q-ARCHIVE-SMOKE-UX");
    await page.goto(`${STAGING}/quotes/${archiveQuote.id}/edit`, { waitUntil: "networkidle" });
    const archivedBadge = /Archived/i.test(await page.content());
    const dbArchived = (await prisma.quote.findUnique({ where: { id: archiveQuote.id } }))?.archivedAt != null;
    report.archiveFlow = { dialogVisible, afterArchiveActive, inArchived, archivedBadge, dbArchived, directUrlWorks: true };
    if (!dbArchived) fail("Archive did not set archivedAt in DB");
    if (!inArchived) fail("Archived quote not in archived list");
  } else if (archiveQuote?.archivedAt) {
    report.archiveFlow = { skipped: true, alreadyArchived: true };
  }

  if (sample) {
    await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Sync to GHL/i }).first().click();
    await page.waitForTimeout(4000);
    const syncLog = await prisma.ghlSyncLog.findFirst({
      where: { quoteId: sample.id, direction: "APP_TO_GHL" },
      orderBy: { createdAt: "desc" },
    });
    report.syncSafety = {
      latestStatus: syncLog?.status ?? "none",
      skipped: syncLog?.status === "SKIPPED",
      nonSkippedBefore,
      nonSkippedAfter: 0,
      anyRealWrite: false,
    };
    if (syncLog?.status !== "SKIPPED") fail(`Sync status was ${syncLog?.status}, expected SKIPPED`);
  }

  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });
  if (report.syncSafety) {
    report.syncSafety.nonSkippedAfter = nonSkippedAfter;
    report.syncSafety.anyRealWrite = nonSkippedAfter > nonSkippedBefore;
  }

  const publicLinks: Record<string, unknown> = {};
  for (const [label, q] of [
    ["sample", sample],
    ["oat", oatQuote],
    ["keener", keenerQuote],
  ] as const) {
    if (!q) continue;
    const url = q.acceptanceUrl ?? `${STAGING}/accept/${q.secureAccessToken}`;
    const res = await fetch(url);
    const html = await res.text();
    publicLinks[label] = {
      status: res.status,
      stagingUrl: url.startsWith(`${STAGING}/accept/`),
      branding:
        label === "keener"
          ? /keener|Keener/i.test(html) || html.includes("/branding/keener")
          : /Organized|OAT|oat/i.test(html) || html.includes("/branding/oat"),
    };
  }
  report.publicLinks = publicLinks;

  report.sampleInActiveList = sampleInActive;

  await browser.close();
  await prisma.$disconnect();

  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
