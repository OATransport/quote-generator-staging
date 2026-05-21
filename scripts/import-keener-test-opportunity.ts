/**
 * Import a single approved Keener test opportunity (DB + read-only GHL).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { importGhlOpportunityToQuote } from "@/server/ghl";

loadEnv();

const prisma = new PrismaClient();
const OPP_ID = "RFpzzOpWqlH2BDNC7kGj";
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  const mockMode = !process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  if (mockMode) throw new Error("Mock mode is ON — Keener token required.");

  const appToGhlBefore = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });

  const imported = await importGhlOpportunityToQuote(OPP_ID);

  const quote = await prisma.quote.findUnique({
    where: { id: imported.id },
    include: {
      company: true,
      customerSnapshot: true,
      vehicles: true,
      ghlSyncLogs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!quote) throw new Error("Quote not found after import.");

  const appToGhlAfter = await prisma.ghlSyncLog.count({
    where: { direction: "APP_TO_GHL", status: { not: "SKIPPED" } },
  });
  const oatCount = await prisma.ghlFieldMapping.count({ where: { ghlLocationId: "iisYmOgIc6Ef6uoJ2sVx" } });
  const oatWithIds = await prisma.ghlFieldMapping.count({
    where: { ghlLocationId: "iisYmOgIc6Ef6uoJ2sVx", ghlCustomFieldId: { not: null } },
  });
  const vehicle = quote.vehicles[0];
  const importLog = quote.ghlSyncLogs.find((log) => log.direction === "GHL_TO_APP");

  console.log(
    JSON.stringify(
      {
        mockModeOff: true,
        editUrl: `${BASE}/quotes/${quote.id}/edit`,
        acceptanceUrl: quote.acceptanceUrl ?? `${BASE}/accept/${quote.secureAccessToken}`,
        quote: {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          quoteMode: quote.quoteMode,
          status: quote.status,
          ghlLocationId: quote.ghlLocationId,
          ghlOpportunityId: quote.ghlOpportunityId,
          companyId: quote.companyId,
          companyName: quote.company?.name,
          pickupAddress: quote.pickupAddress,
          pickupCity: quote.pickupCity,
          pickupState: quote.pickupState,
          pickupZip: quote.pickupZip,
          pickupDate: quote.pickupDate,
          deliveryAddress: quote.deliveryAddress,
          deliveryCity: quote.deliveryCity,
          deliveryState: quote.deliveryState,
          deliveryZip: quote.deliveryZip,
          trailerType: quote.trailerType,
          customerNotes: quote.customerNotes,
          customer: {
            name: quote.customerSnapshot?.name,
            email: quote.customerSnapshot?.email,
            phone: quote.customerSnapshot?.phone,
          },
          vehicle: vehicle
            ? {
                year: vehicle.year,
                make: vehicle.make,
                model: vehicle.model,
                type: vehicle.type,
                isRunning: vehicle.isRunning,
                notes: vehicle.notes,
              }
            : null,
        },
        importSyncLog: importLog
          ? { direction: importLog.direction, status: importLog.status, errorMessage: importLog.errorMessage }
          : null,
        realGhlWriteOccurred: appToGhlAfter > appToGhlBefore,
        oatMappingCount: oatCount,
        oatWithCustomFieldIds: oatWithIds,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
