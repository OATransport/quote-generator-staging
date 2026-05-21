/**
 * Verify real OAT GHL pipeline import (read search + optional import via dev server).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient();
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const LOCATION_ID = process.env.GHL_LOCATION_ID?.trim();
const PIPELINE_ID = process.env.GHL_QUOTE_PIPELINE_ID?.trim();
const NEW_QUOTE_STAGE_ID = process.env.GHL_DEFAULT_STAGE_ID?.trim() ?? "f1f24ff4-aff1-4c47-a4bf-653b867de803";
const STAGE_NAMES: Record<string, string> = {
  "f1f24ff4-aff1-4c47-a4bf-653b867de803": "New Quote Request",
  "0407f871-0e19-41ef-8145-223e66c365a3": "Contacted",
  "2510f476-fbcd-43db-a7a1-493395dbd4f5": "Follow Up",
  "e6c7cad1-64f8-4acc-89b9-95f59cab1a1e": "Booked",
  "a55323a4-5c88-4eb2-b399-631bf7d266f5": "Lost",
};

type OpportunityRow = {
  id: string;
  name: string;
  stageId?: string;
  stageName: string;
  customerName?: string;
  email?: string;
  phone?: string;
};

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const content = readFileSync(envPath, "utf8");
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

async function ghlRead<T>(path: string): Promise<T> {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  if (!token) throw new Error("GHL_PRIVATE_INTEGRATION_TOKEN is not set.");
  const response = await fetch(`${process.env.GHL_API_BASE_URL?.replace(/\/$/, "") ?? "https://services.leadconnectorhq.com"}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: process.env.GHL_API_VERSION ?? "2021-07-28",
      Accept: "application/json",
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${path} failed ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

function normalizeOpportunities(data: unknown) {
  const object = data as Record<string, unknown>;
  return ((object.opportunities ?? object.items ?? object.data ?? []) as Array<Record<string, unknown>>).filter(Boolean);
}

async function enrichContact(opportunity: Record<string, unknown>) {
  const contactId = opportunity.contactId ? String(opportunity.contactId) : undefined;
  let contact: Record<string, unknown> | undefined = opportunity.contact as Record<string, unknown> | undefined;
  if (!contact && contactId) {
    try {
      const data = await ghlRead<Record<string, unknown>>(`/contacts/${encodeURIComponent(contactId)}`);
      contact = (data.contact ?? data) as Record<string, unknown>;
    } catch {
      contact = undefined;
    }
  }
  const stageId = String(opportunity.pipelineStageId ?? opportunity.stageId ?? "");
  const customerName =
    String(contact?.name ?? "") ||
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
    String(opportunity.name ?? "Unknown customer");
  return {
    id: String(opportunity.id),
    name: String(opportunity.name ?? "Untitled opportunity"),
    stageId: stageId || undefined,
    stageName: STAGE_NAMES[stageId] ?? stageId ?? "Unstaged",
    customerName,
    email: contact?.email ? String(contact.email) : undefined,
    phone: contact?.phone ? String(contact.phone) : undefined,
  } satisfies OpportunityRow;
}

async function listPipelineOpportunities(): Promise<OpportunityRow[]> {
  if (!LOCATION_ID || !PIPELINE_ID) {
    throw new Error("GHL_LOCATION_ID and GHL_QUOTE_PIPELINE_ID must be set in .env");
  }
  const params = new URLSearchParams({
    location_id: LOCATION_ID,
    pipeline_id: PIPELINE_ID,
  });
  const data = await ghlRead<unknown>(`/opportunities/search?${params.toString()}`);
  const rows = normalizeOpportunities(data).filter((item) => String(item.pipelineId ?? "") === PIPELINE_ID);
  return Promise.all(rows.map(enrichContact));
}

async function pageHasMockBanner(html: string) {
  return html.includes("Mock GHL mode is active");
}

async function verifyImportPages(mockModeOff: boolean) {
  for (const path of ["/import", "/dashboard/import-ghl"]) {
    const response = await fetch(`${BASE}${path}`);
    const html = await response.text();
    const mockBanner = await pageHasMockBanner(html);
    console.log(`   ${path}: HTTP ${response.status}, mock banner=${mockBanner}`);
    if (mockModeOff && mockBanner) throw new Error(`${path} still shows mock banner in real mode.`);
    if (!mockModeOff && !mockBanner) throw new Error(`${path} missing mock banner in mock mode.`);
  }
}

async function importViaApp(opportunityId: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(
    `${BASE}/dashboard/import-ghl?stageId=${encodeURIComponent(NEW_QUOTE_STAGE_ID)}&q=${encodeURIComponent(opportunityId)}`,
  );
  await page.waitForLoadState("networkidle");
  const openExisting = page.getByRole("link", { name: /Open Existing Quote/i }).first();
  if (await openExisting.isVisible().catch(() => false)) {
    await openExisting.click();
    await page.waitForURL(/\/quotes\/.*\/edit/);
    const url = page.url();
    await browser.close();
    return { mode: "existing" as const, editUrl: url };
  }
  const importButton = page.getByRole("button", { name: "Import to Quote" }).first();
  if (!(await importButton.isVisible().catch(() => false))) {
    await page.goto(`${BASE}/dashboard/import-ghl?stageId=${encodeURIComponent(NEW_QUOTE_STAGE_ID)}`);
    await page.waitForLoadState("networkidle");
    const row = page.locator("tr", { hasText: opportunityId });
    if (await row.count()) {
      await row.getByRole("button", { name: "Import to Quote" }).click();
    } else {
      await page.getByRole("button", { name: "Import to Quote" }).first().click();
    }
  } else {
    await importButton.click();
  }
  await page.waitForURL(/\/quotes\/.*\/edit/, { timeout: 60000 });
  const editUrl = page.url();
  await browser.close();
  return { mode: "imported" as const, editUrl };
}

async function main() {
  console.log("=== OAT Real GHL Import Verification ===\n");

  const mockMode = !process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  console.log(`1. Mock mode: ${mockMode ? "ON" : "OFF"}`);
  if (mockMode) throw new Error("Mock mode is ON — set OAT token first.");

  const health = await fetch(BASE).then((r) => r.status).catch(() => 0);
  if (health !== 200) {
    throw new Error(`Dev server not running at ${BASE}. Start with: npm run dev`);
  }

  console.log("\n2. Import pages (real vs mock UI):");
  await verifyImportPages(true);

  console.log("\n3. Searching pipeline opportunities...");
  const all = await listPipelineOpportunities();
  console.log(`   Total in pipeline ${PIPELINE_ID}: ${all.length}`);
  for (const row of all) {
    console.log(`   - ${row.name} | stage=${row.stageName} | ${row.customerName} | ${row.email ?? "no email"} | ${row.phone ?? "no phone"} | ${row.id}`);
  }

  const newQuoteRows = all.filter((row) => row.stageId === NEW_QUOTE_STAGE_ID);
  console.log(`\n4. New Quote Request stage (${NEW_QUOTE_STAGE_ID}): ${newQuoteRows.length} opportunity(ies)`);

  if (!newQuoteRows.length) {
    console.log("\nSTOP: No opportunities in New Quote Request.");
    console.log("Submit a fresh internal test quote through the OAT public quote form, then re-run.");
    process.exitCode = 2;
    return;
  }

  const target = newQuoteRows[0];
  console.log(`\n5. Importing: ${target.name} (${target.id}) — ${target.customerName}`);

  const appToGhlBefore = await prisma.ghlSyncLog.count({ where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } } });
  const importResult = await importViaApp(target.id);
  const quoteIdMatch = importResult.editUrl.match(/\/quotes\/([^/]+)\/edit/);
  if (!quoteIdMatch) throw new Error("Could not parse quote ID from edit URL.");
  const quoteId = quoteIdMatch[1];

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customerSnapshot: true,
      vehicles: true,
      ghlSyncLogs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!quote) throw new Error("Quote not found after import.");

  const importLog = quote.ghlSyncLogs.find((log) => log.direction === "GHL_TO_APP");
  const appToGhlAfter = await prisma.ghlSyncLog.count({ where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } } });
  const vehicle = quote.vehicles[0];

  console.log("\n=== RESULT JSON ===");
  console.log(
    JSON.stringify(
      {
        mockModeOff: true,
        opportunitiesInPipeline: all.length,
        newQuoteRequestCount: newQuoteRows.length,
        importedOpportunityId: target.id,
        importedOpportunityName: target.name,
        importMode: importResult.mode,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        editUrl: importResult.editUrl,
        acceptanceUrl: quote.acceptanceUrl ?? `${BASE}/accept/${quote.secureAccessToken}`,
        status: quote.status,
        ghlOpportunityId: quote.ghlOpportunityId,
        ghlStageId: quote.ghlStageId,
        customer: {
          name: quote.customerSnapshot.name,
          email: quote.customerSnapshot.email,
          phone: quote.customerSnapshot.phone,
        },
        route: {
          pickupCity: quote.pickupCity,
          pickupState: quote.pickupState,
          pickupZip: quote.pickupZip,
          pickupAddress: quote.pickupAddress,
          deliveryCity: quote.deliveryCity,
          deliveryState: quote.deliveryState,
          deliveryZip: quote.deliveryZip,
          deliveryAddress: quote.deliveryAddress,
        },
        vehicle: vehicle
          ? { year: vehicle.year, make: vehicle.make, model: vehicle.model, type: vehicle.type, condition: vehicle.condition }
          : null,
        notes: { customerNotes: quote.customerNotes, internalNotes: quote.internalNotes },
        importSyncLog: importLog
          ? { direction: importLog.direction, status: importLog.status, errorMessage: importLog.errorMessage }
          : null,
        realGhlWriteOccurred: appToGhlAfter > appToGhlBefore,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("\nVERIFICATION FAILED:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
