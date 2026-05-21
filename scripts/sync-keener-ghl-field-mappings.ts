/**
 * Sync Keener Logistics GoHighLevel contact custom field IDs into GhlFieldMapping (DB only).
 * READ-ONLY toward GHL — no create/update/delete on GHL records.
 *
 * Usage:
 *   npx tsx scripts/sync-keener-ghl-field-mappings.ts           # dry-run (default)
 *   npx tsx scripts/sync-keener-ghl-field-mappings.ts --apply   # write to DB
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");
const KEENER_GHL_LOCATION_ID = "secdHfMuJKMfpDpHFMHw";

/** Unambiguous Keener → internal app field mappings. */
const KEENER_CONTACT_FIELD_TARGETS: Array<{
  appFieldKey: string;
  fieldKeys: string[];
  names: string[];
  isRequired?: boolean;
  note?: string;
}> = [
  {
    appFieldKey: "vehicleYear",
    fieldKeys: ["contact.year_of_vehicle"],
    names: ["Year of Vehicle"],
  },
  {
    appFieldKey: "trailerType",
    fieldKeys: ["contact.transport_type"],
    names: ["Transport Type"],
    note: "Keener Transport Type maps to trailerType (closest internal field).",
  },
  {
    appFieldKey: "vehicleIsRunning",
    fieldKeys: ["contact.vehicle_running_status"],
    names: ["Vehicle Running Status"],
  },
  {
    appFieldKey: "pickupAddress",
    fieldKeys: ["contact.pickup_city"],
    names: ["Pickup Address"],
    note: "Keener stores combined pickup location in fieldKey contact.pickup_city.",
  },
  {
    appFieldKey: "pickupDate",
    fieldKeys: ["contact.first_available_pickup_date"],
    names: ["First Available Pickup Date"],
  },
  {
    appFieldKey: "deliveryAddress",
    fieldKeys: ["contact.delivery_city"],
    names: ["Delivery Address"],
    note: "Keener stores combined delivery location in fieldKey contact.delivery_city.",
  },
  {
    appFieldKey: "customerNotes",
    fieldKeys: ["contact.shipment_notes"],
    names: ["Shipment Notes"],
  },
  {
    appFieldKey: "vehicleNotes",
    fieldKeys: ["contact.quote_summary"],
    names: ["Quote Summary"],
    note: "Quote Summary may include make/model text — stored as vehicleNotes, not parsed into make/model.",
  },
];

/** Keener fields intentionally left unmapped — ambiguous or no internal target. */
const KEENER_UNMAPPED: Array<{ fieldKeys: string[]; names: string[]; reason: string }> = [
  {
    fieldKeys: ["contact.pickup_context"],
    names: ["Pickup Context"],
    reason: "No clear internal field (not pickupContactName vs notes without seeing consistent values).",
  },
  {
    fieldKeys: ["contact.shipment_type"],
    names: ["Shipment Type"],
    reason: "Not clearly trailerType, quoteMode, or vehicleType.",
  },
  {
    fieldKeys: ["contact.include_second_vehicle"],
    names: ["Include Second Vehicle"],
    reason: "No internal schema field for second-vehicle flag.",
  },
  {
    fieldKeys: ["contact.make_model"],
    names: ["Make & Model"],
    reason: "Combined make/model — not parsed into vehicleMake/vehicleModel.",
  },
];

type GhlCustomField = {
  id: string;
  name: string;
  fieldKey?: string;
  model?: string;
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
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (locationId && locationId !== KEENER_GHL_LOCATION_ID) {
    throw new Error(
      `Expected Keener GHL_LOCATION_ID=${KEENER_GHL_LOCATION_ID}, got ${locationId}. Switch .env to Keener before running.`,
    );
  }

  const baseUrl = (process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: process.env.GHL_API_VERSION ?? "2021-07-28",
      Accept: "application/json",
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GHL read failed ${response.status} ${path}: ${text}`);
  }
  return JSON.parse(text) as T;
}

function normalizeCustomFields(data: unknown): GhlCustomField[] {
  const object = data as Record<string, unknown>;
  const fields = (object.customFields ?? object.fields ?? object.data ?? []) as Array<Record<string, unknown>>;
  return fields
    .map((field) => ({
      id: String(field.id ?? ""),
      name: String(field.name ?? field.fieldKey ?? ""),
      fieldKey: field.fieldKey ? String(field.fieldKey) : field.key ? String(field.key) : undefined,
      model: field.model ? String(field.model) : undefined,
    }))
    .filter((field) => field.id);
}

function findGhlField(fields: GhlCustomField[], target: (typeof KEENER_CONTACT_FIELD_TARGETS)[number]) {
  return fields.find(
    (field) =>
      (field.fieldKey && target.fieldKeys.includes(field.fieldKey)) ||
      target.names.some((name) => field.name.trim().toLowerCase() === name.toLowerCase()),
  );
}

async function main() {
  const data = await ghlRead<unknown>(`/locations/${encodeURIComponent(KEENER_GHL_LOCATION_ID)}/customFields`);
  const fields = normalizeCustomFields(data);

  const mapped: Array<{
    appFieldKey: string;
    ghlCustomFieldId: string;
    ghlCustomFieldName: string;
    fieldKey?: string;
    note?: string;
  }> = [];
  const missingTargets: string[] = [];
  const ambiguous: Array<{ fieldKey?: string; name: string; id: string; reason: string }> = [];

  for (const target of KEENER_CONTACT_FIELD_TARGETS) {
    const match = findGhlField(fields, target);
    if (!match) {
      missingTargets.push(target.appFieldKey);
      continue;
    }

    if (applyChanges) {
      await prisma.ghlFieldMapping.upsert({
        where: {
          ghlLocationId_appFieldKey: {
            ghlLocationId: KEENER_GHL_LOCATION_ID,
            appFieldKey: target.appFieldKey,
          },
        },
        update: {
          ghlCustomFieldId: match.id,
          ghlCustomFieldName: match.name,
          isRequired: Boolean(target.isRequired),
        },
        create: {
          ghlLocationId: KEENER_GHL_LOCATION_ID,
          appFieldKey: target.appFieldKey,
          ghlCustomFieldId: match.id,
          ghlCustomFieldName: match.name,
          isRequired: Boolean(target.isRequired),
        },
      });
    }

    mapped.push({
      appFieldKey: target.appFieldKey,
      ghlCustomFieldId: match.id,
      ghlCustomFieldName: match.name,
      fieldKey: match.fieldKey,
      note: target.note,
    });
  }

  for (const entry of KEENER_UNMAPPED) {
    const match = fields.find(
      (field) =>
        (field.fieldKey && entry.fieldKeys.includes(field.fieldKey)) ||
        entry.names.some((name) => field.name.trim().toLowerCase() === name.toLowerCase()),
    );
    if (!match) continue;
    ambiguous.push({
      id: match.id,
      name: match.name,
      fieldKey: match.fieldKey,
      reason: entry.reason,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: applyChanges ? "apply" : "dry-run",
        ghlLocationId: KEENER_GHL_LOCATION_ID,
        mapped,
        missingTargets,
        ambiguous,
        applyChanges,
      },
      null,
      2,
    ),
  );

  if (!applyChanges) {
    console.error("\nDry-run only. Re-run with --apply to write Keener mappings.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
