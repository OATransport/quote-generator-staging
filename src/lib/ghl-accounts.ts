import { KEENER_GHL_LOCATION_ID, OAT_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";

export const GHL_IMPORT_ACCOUNTS = [
  {
    key: "oat",
    label: "Organized Auto Transport",
    ghlLocationId: OAT_GHL_LOCATION_ID,
    pipelineName: "Organized Auto Transport Quote Request Pipeline",
    stageName: "New Quote Request",
  },
  {
    key: "keener",
    label: "Keener Logistics",
    ghlLocationId: KEENER_GHL_LOCATION_ID,
    pipelineName: "Quote Pipeline",
    stageName: "New Quote",
  },
] as const;

export type GhlImportAccountKey = (typeof GHL_IMPORT_ACCOUNTS)[number]["key"];

export function isGhlImportAccountKey(value: string | undefined | null): value is GhlImportAccountKey {
  return value === "oat" || value === "keener";
}

export function defaultGhlImportAccountKey(): GhlImportAccountKey {
  const activeLocation = process.env.GHL_LOCATION_ID?.trim();
  if (activeLocation === KEENER_GHL_LOCATION_ID) return "keener";
  return "oat";
}

export function resolveGhlImportAccountKey(value: string | undefined | null): GhlImportAccountKey {
  return isGhlImportAccountKey(value) ? value : defaultGhlImportAccountKey();
}

export function ghlLocationIdForAccountKey(accountKey: GhlImportAccountKey) {
  const account = GHL_IMPORT_ACCOUNTS.find((entry) => entry.key === accountKey);
  if (!account) throw new Error(`Unknown GHL import account key: ${accountKey}`);
  return account.ghlLocationId;
}

export function accountKeyForGhlLocationId(ghlLocationId: string): GhlImportAccountKey | undefined {
  return GHL_IMPORT_ACCOUNTS.find((entry) => entry.ghlLocationId === ghlLocationId)?.key;
}

export function labelForGhlImportAccountKey(accountKey: GhlImportAccountKey) {
  return GHL_IMPORT_ACCOUNTS.find((entry) => entry.key === accountKey)?.label ?? accountKey;
}
