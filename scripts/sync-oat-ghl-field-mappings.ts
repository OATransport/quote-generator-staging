/**
 * Sync OAT GoHighLevel contact custom field IDs into GhlFieldMapping (DB only).
 * READ-ONLY toward GHL — no create/update/delete on GHL records.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient();
const OAT_GHL_LOCATION_ID = "iisYmOgIc6Ef6uoJ2sVx";

/** Match GHL fieldKey (preferred) or exact field name to internal appFieldKey. */
const OAT_CONTACT_FIELD_TARGETS: Array<{
  appFieldKey: string;
  fieldKeys: string[];
  names: string[];
  isRequired?: boolean;
  fallbackPath?: string;
}> = [
  { appFieldKey: "pickupAddress", fieldKeys: ["contact.pickup_address"], names: ["Pickup Address"] },
  { appFieldKey: "pickupCity", fieldKeys: ["contact.pickup_city"], names: ["Pickup City"], isRequired: true },
  { appFieldKey: "pickupState", fieldKeys: ["contact.pickup_state"], names: ["Pickup State"], isRequired: true },
  { appFieldKey: "pickupZip", fieldKeys: ["contact.pickup_zip"], names: ["Pickup Zip"] },
  { appFieldKey: "pickupDate", fieldKeys: ["contact.pickup_date"], names: ["Pickup Date"] },
  { appFieldKey: "deliveryAddress", fieldKeys: ["contact.delivery_address"], names: ["Delivery Address"] },
  { appFieldKey: "deliveryCity", fieldKeys: ["contact.delivery_city"], names: ["Delivery City"], isRequired: true },
  { appFieldKey: "deliveryState", fieldKeys: ["contact.delivery_state"], names: ["Delivery State"], isRequired: true },
  { appFieldKey: "deliveryZip", fieldKeys: ["contact.delivery_zip"], names: ["Delivery Zip"] },
  { appFieldKey: "vehicleYear", fieldKeys: ["contact.vehicle_year"], names: ["Vehicle Year"] },
  { appFieldKey: "vehicleMake", fieldKeys: ["contact.vehicle_make"], names: ["Vehicle Make"], isRequired: true },
  { appFieldKey: "vehicleModel", fieldKeys: ["contact.vehicle_model"], names: ["Vehicle Model"], isRequired: true },
  { appFieldKey: "vehicleType", fieldKeys: ["contact.vehicle_type"], names: ["Vehicle Type"] },
  { appFieldKey: "vehicleIsRunning", fieldKeys: ["contact.vehicle_running"], names: ["Vehicle Running"] },
  { appFieldKey: "vehicleNotes", fieldKeys: ["contact.vehicles_summary"], names: ["Vehicles Summary"] },
  { appFieldKey: "customerNotes", fieldKeys: ["contact.shipment_notes"], names: ["Shipment Notes"] },
];

/** Known OAT fields with no unambiguous internal target — reported, not mapped. */
const OAT_UNMAPPED_FIELD_KEYS = [
  "contact.pickup_flexibility",
  "contact.vehicle_count",
  "contact.customer_type",
  "contact.landing_page_url",
  "contact.utm_source",
  "contact.utm_medium",
  "contact.utm_campaign",
] as const;

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

function findGhlField(fields: GhlCustomField[], target: (typeof OAT_CONTACT_FIELD_TARGETS)[number]) {
  return fields.find(
    (field) =>
      (field.fieldKey && target.fieldKeys.includes(field.fieldKey)) ||
      target.names.some((name) => field.name.toLowerCase() === name.toLowerCase()),
  );
}

async function main() {
  const data = await ghlRead<unknown>(`/locations/${encodeURIComponent(OAT_GHL_LOCATION_ID)}/customFields`);
  const fields = normalizeCustomFields(data);

  const mapped: Array<{ appFieldKey: string; ghlCustomFieldId: string; ghlCustomFieldName: string; fieldKey?: string }> =
    [];
  const missingTargets: string[] = [];
  const ambiguous: Array<{ fieldKey?: string; name: string; id: string; reason: string }> = [];

  for (const target of OAT_CONTACT_FIELD_TARGETS) {
    const match = findGhlField(fields, target);
    if (!match) {
      missingTargets.push(target.appFieldKey);
      continue;
    }
    await prisma.ghlFieldMapping.upsert({
      where: {
        ghlLocationId_appFieldKey: {
          ghlLocationId: OAT_GHL_LOCATION_ID,
          appFieldKey: target.appFieldKey,
        },
      },
      update: {
        ghlCustomFieldId: match.id,
        ghlCustomFieldName: match.name,
        fallbackPath: target.fallbackPath ?? null,
        isRequired: Boolean(target.isRequired),
      },
      create: {
        ghlLocationId: OAT_GHL_LOCATION_ID,
        appFieldKey: target.appFieldKey,
        ghlCustomFieldId: match.id,
        ghlCustomFieldName: match.name,
        fallbackPath: target.fallbackPath ?? null,
        isRequired: Boolean(target.isRequired),
      },
    });
    mapped.push({
      appFieldKey: target.appFieldKey,
      ghlCustomFieldId: match.id,
      ghlCustomFieldName: match.name,
      fieldKey: match.fieldKey,
    });
  }

  for (const fieldKey of OAT_UNMAPPED_FIELD_KEYS) {
    const match = fields.find((field) => field.fieldKey === fieldKey);
    if (!match) continue;
    ambiguous.push({
      id: match.id,
      name: match.name,
      fieldKey: match.fieldKey,
      reason: "No dedicated internal app field — needs schema/UI decision before mapping.",
    });
  }

  const unlistedGhlFields = fields.filter((field) => {
    const key = field.fieldKey ?? "";
    const inTargets = OAT_CONTACT_FIELD_TARGETS.some(
      (target) => target.fieldKeys.includes(key) || target.names.some((name) => name.toLowerCase() === field.name.toLowerCase()),
    );
    const inUnmapped = OAT_UNMAPPED_FIELD_KEYS.includes(key as (typeof OAT_UNMAPPED_FIELD_KEYS)[number]);
    return !inTargets && !inUnmapped;
  });

  console.log(JSON.stringify({ mapped, missingTargets, ambiguous, unlistedGhlFields }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
