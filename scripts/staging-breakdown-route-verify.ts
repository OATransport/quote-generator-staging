/**
 * Staging verification for itemized breakdown + USA route map deploy.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const STAGING = "https://staging-app.shipwithoat.com";

function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (process.env[k] !== undefined) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

type Result = { name: string; pass: boolean; detail?: string };

async function main() {
  loadEnv();
  process.env.DATABASE_URL = process.env.STAGING_DATABASE_URL?.trim() ?? process.env.DATABASE_URL ?? "";
  const prisma = new PrismaClient();
  const results: Result[] = [];
  const pass = (name: string, detail?: string) => results.push({ name, pass: true, detail });
  const fail = (name: string, detail?: string) => results.push({ name, pass: false, detail });

  const sample = await prisma.quote.findUnique({ where: { quoteNumber: "Q-SAMPLE-00001" } });
  if (!sample) throw new Error("Q-SAMPLE-00001 not found");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    httpCredentials: { username: process.env.BASIC_AUTH_USER!, password: process.env.BASIC_AUTH_PASSWORD! },
  });

  async function fetchAcceptHtml() {
    const res = await fetch(`${STAGING}/accept/test-accept-token`);
    return res.text();
  }

  // A — Simple total mode
  await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /Simple total/i }).click();
  await page.locator("#customerTransportationPrice").fill("1300");
  await page.locator("#depositDue").fill("100");
  await page.locator("#carrierPay").fill("1000");
  await page.getByRole("button", { name: /Save quote/i }).click();
  await page.waitForTimeout(3500);

  let acceptHtml = await fetchAcceptHtml();
  if (/Vehicle Transportation Service/i.test(acceptHtml) && !/Base Transport/i.test(acceptHtml)) pass("A: one clean service line");
  else fail("A: one clean service line");
  if (/Deposit Due Today/i.test(acceptHtml)) pass("A: deposit label");
  else fail("A: deposit label");
  if (/Balance Due on Delivery/i.test(acceptHtml)) pass("A: balance label");
  else fail("A: balance label");
  if (!/carrier pay|broker fee|margin %/i.test(acceptHtml)) pass("A: broker hidden");
  else fail("A: broker hidden");

  // B — Itemized breakdown edit
  await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /Itemized customer breakdown/i }).click();
  await page.waitForTimeout(500);
  await page.locator('text=Optional customer price breakdown').scrollIntoViewIfNeeded();

  if ((await page.locator('input[name^="feeAmount_"]').count()) === 0) {
    await page.getByRole("button", { name: /Add breakdown line/i }).click();
    await page.waitForTimeout(300);
  }

  await page.locator('input[name^="feeLabel_"]').first().fill("Expedited Delivery Fee");
  await page.locator('input[name^="feeAmount_"]').first().fill("150");
  await page.locator("#customerTransportationPrice").fill("1300");
  await page.waitForTimeout(800);

  const editBody = await page.locator("body").innerText();
  const hasMismatch =
    /Breakdown total is \$150\.00/i.test(editBody) &&
    /Transportation Service Price is \$1,300\.00/i.test(editBody) &&
    /Add \$1,150\.00/i.test(editBody);
  if (hasMismatch) pass("B: exact mismatch warning");
  else fail("B: exact mismatch warning");

  await page.getByRole("button", { name: /Add base transport line/i }).click();
  await page.waitForTimeout(800);
  const afterAdd = await page.locator("body").innerText();
  if (/Base Transport/i.test(afterAdd) && /matches transportation service price/i.test(afterAdd)) {
    pass("B: base transport added and matched");
  } else fail("B: base transport added and matched");

  await page.getByRole("button", { name: /Save quote/i }).click();
  await page.waitForTimeout(3500);
  await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
  const reloaded = await page.locator("body").innerText();
  if (/Itemized customer breakdown/i.test(reloaded) && /Base Transport/i.test(reloaded) && /Expedited Delivery Fee/i.test(reloaded)) {
    pass("B: persist mode and rows");
  } else fail("B: persist mode and rows");

  // C — Public itemized display
  acceptHtml = await fetchAcceptHtml();
  const publicChecks: Array<[string, string]> = [
    ["Base Transport", "1,150"],
    ["Expedited Delivery Fee", "150"],
    ["Transportation Service Total", "1,300"],
    ["Deposit Due Today", "100"],
    ["Balance Due on Delivery", "1,200"],
  ];
  for (const [label, amount] of publicChecks) {
    if (acceptHtml.includes(label) && acceptHtml.includes(amount)) pass(`C: ${label}`);
    else fail(`C: ${label}`);
  }
  if (!/carrier pay|broker fee|margin|internal notes/i.test(acceptHtml)) pass("C: internal hidden");
  else fail("C: internal hidden");

  // D — Internal-only row
  await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Add breakdown line/i }).click();
  await page.waitForTimeout(300);
  await page.locator('select[name^="feeVisibility_"]').last().selectOption("internal");
  await page.locator('input[name^="feeLabel_"]').last().fill("Internal Dispatch Cost");
  await page.locator('input[name^="feeAmount_"]').last().fill("99");
  await page.waitForTimeout(400);

  const checkboxCount = await page.locator('input[name="feeCustomerVisible"]').count();
  if (checkboxCount === 0) pass("D: visibility select only");
  else fail("D: visibility select only", `checkboxes=${checkboxCount}`);

  await page.getByRole("button", { name: /Save quote/i }).click();
  await page.waitForTimeout(3500);
  acceptHtml = await fetchAcceptHtml();
  if (!/Internal Dispatch Cost/i.test(acceptHtml)) pass("D: internal row hidden publicly");
  else fail("D: internal row hidden publicly");

  // E — USA route map
  await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
  await page.locator("#pickupCity").fill("");
  await page.locator("#pickupState").fill("");
  await page.locator("#pickupZip").fill("46204");
  await page.getByRole("button", { name: /Lookup city\/state/i }).first().click();
  await page.waitForTimeout(1500);
  await page.locator("#deliveryCity").fill("");
  await page.locator("#deliveryState").fill("");
  await page.locator("#deliveryZip").fill("33602");
  await page.getByRole("button", { name: /Lookup city\/state/i }).nth(1).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Save quote/i }).click();
  await page.waitForTimeout(3500);

  acceptHtml = await fetchAcceptHtml();
  if (/U\.S\. transport route/i.test(acceptHtml)) pass("E: USA map visual");
  else fail("E: USA map visual");
  if (/Approx\. route distance/i.test(acceptHtml)) pass("E: approximate distance");
  else fail("E: approximate distance");
  if (/Final dispatch route may vary/i.test(acceptHtml)) pass("E: distance disclaimer");
  else fail("E: distance disclaimer");

  // F — Release readiness
  await page.goto(`${STAGING}/`, { waitUntil: "networkidle" });
  const dash = await page.locator("body").innerText();
  if (/Release readiness/i.test(dash)) pass("F: card appears");
  else fail("F: card appears");
  for (const item of [
    "Quote model selector",
    "Pricing model",
    "Itemized breakdown",
    "Vehicle editing",
    "ZIP autofill",
    "Public quote page",
    "Route map visual",
    "GHL import",
    "GHL sync-back",
  ]) {
    if (dash.includes(item)) pass(`F: lists ${item}`);
    else fail(`F: lists ${item}`);
  }
  if (/Disabled by design/i.test(dash)) pass("F: sync-back disabled by design");
  else fail("F: sync-back disabled by design");

  // G — Sync safety
  const nonSkippedBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });
  await page.goto(`${STAGING}/quotes/${sample.id}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sync to GHL/i }).first().click();
  await page.waitForTimeout(4000);
  const syncLog = await prisma.ghlSyncLog.findFirst({
    where: { quoteId: sample.id, direction: "APP_TO_GHL" },
    orderBy: { createdAt: "desc" },
  });
  const nonSkippedAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });
  if (syncLog?.status === "SKIPPED") pass("G: manual sync SKIPPED");
  else fail("G: manual sync SKIPPED", syncLog?.status ?? "none");
  if (nonSkippedAfter === nonSkippedBefore) pass("G: no new non-SKIPPED logs");
  else fail("G: no new non-SKIPPED logs");

  await browser.close();
  await prisma.$disconnect();

  const failures = results.filter((r) => !r.pass);
  console.log(
    JSON.stringify(
      {
        commit: "b1aac12",
        passed: results.length - failures.length,
        total: results.length,
        failures: failures.map((f) => ({ name: f.name, detail: f.detail })),
      },
      null,
      2,
    ),
  );
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
