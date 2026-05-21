import type { QuoteMode } from "@prisma/client";
import type { GhlFieldMapping } from "@prisma/client";
import { knownGhlFieldRefsForLocation } from "@/lib/ghl-known-field-ids";
import { prisma } from "@/lib/prisma";

export const OAT_GHL_LOCATION_ID = "iisYmOgIc6Ef6uoJ2sVx";
export const KEENER_GHL_LOCATION_ID = "secdHfMuJKMfpDpHFMHw";
export const OAT_COMPANY_ID = "organized-auto-transport";
export const KEENER_COMPANY_ID = "keener-logistics";

export type GhlLocationCompanyDefaults = {
  companyId: string;
  quoteMode: QuoteMode;
};

export function getActiveGhlLocationId() {
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (!locationId) {
    throw new Error("GHL_LOCATION_ID is not configured.");
  }
  return locationId;
}

export function getActiveGhlLocationIdOrNull() {
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  return locationId || null;
}

export function ghlFieldMappingWhere(ghlLocationId: string, appFieldKey: string) {
  return {
    ghlLocationId_appFieldKey: {
      ghlLocationId,
      appFieldKey,
    },
  };
}

export async function getGhlFieldMappingsForLocation(ghlLocationId: string) {
  const mappings = await prisma.ghlFieldMapping.findMany({
    where: { ghlLocationId },
    orderBy: { appFieldKey: "asc" },
  });
  return enrichGhlFieldMappings(mappings, ghlLocationId);
}

export function enrichGhlFieldMappings<T extends {
  appFieldKey: string;
  ghlCustomFieldId: string | null;
  ghlCustomFieldName: string | null;
  fallbackPath?: string | null;
}>(mappings: T[], ghlLocationId: string) {
  const known = knownGhlFieldRefsForLocation(ghlLocationId);
  return mappings.map((mapping) => {
    const ref = known[mapping.appFieldKey];
    if (!ref) return mapping;
    return {
      ...mapping,
      ghlCustomFieldId: mapping.ghlCustomFieldId ?? ref.ghlCustomFieldId ?? null,
      ghlCustomFieldName: mapping.ghlCustomFieldName ?? ref.ghlCustomFieldName ?? ref.ghlFieldKey,
      fallbackPath: mapping.fallbackPath ?? ref.fallbackPath ?? ref.ghlFieldKey,
    };
  });
}

export function ensureImportMappings(mappings: GhlFieldMapping[], ghlLocationId: string): GhlFieldMapping[] {
  const enriched = enrichGhlFieldMappings(mappings, ghlLocationId);
  const byKey = new Map(enriched.map((mapping) => [mapping.appFieldKey, mapping]));
  const known = knownGhlFieldRefsForLocation(ghlLocationId);
  const now = new Date();

  for (const [appFieldKey, ref] of Object.entries(known)) {
    if (ref.optional) continue;
    if (byKey.has(appFieldKey)) continue;
    byKey.set(appFieldKey, {
      id: `known-${ghlLocationId}-${appFieldKey}`,
      ghlLocationId,
      appFieldKey,
      ghlCustomFieldId: ref.ghlCustomFieldId ?? null,
      ghlCustomFieldName: ref.ghlCustomFieldName ?? ref.ghlFieldKey,
      fallbackPath: ref.fallbackPath ?? ref.ghlFieldKey,
      isRequired: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  return Array.from(byKey.values());
}

export async function getGhlFieldMappingsForActiveLocation() {
  const locationId = getActiveGhlLocationIdOrNull();
  if (!locationId) {
    return [];
  }
  return getGhlFieldMappingsForLocation(locationId);
}

export function resolveQuoteGhlLocationId(quote: { ghlLocationId?: string | null }) {
  if (quote.ghlLocationId?.trim()) {
    return quote.ghlLocationId.trim();
  }
  return getActiveGhlLocationId();
}

export function resolveQuoteGhlLocationIdOrNull(quote: { ghlLocationId?: string | null }) {
  if (quote.ghlLocationId?.trim()) {
    return quote.ghlLocationId.trim();
  }
  return getActiveGhlLocationIdOrNull();
}

export function resolveOpportunityGhlLocationId(opportunity: { locationId?: unknown; [key: string]: unknown }) {
  const locationId = opportunity.locationId;
  if (typeof locationId === "string" && locationId.trim()) {
    return locationId.trim();
  }
  return getActiveGhlLocationId();
}

export function mockCompanyToGhlLocationId(companyId: string) {
  if (companyId === KEENER_COMPANY_ID) {
    return KEENER_GHL_LOCATION_ID;
  }
  return OAT_GHL_LOCATION_ID;
}

export function resolveCompanyAndQuoteModeForGhlLocation(ghlLocationId: string): GhlLocationCompanyDefaults {
  if (ghlLocationId === KEENER_GHL_LOCATION_ID) {
    return { companyId: KEENER_COMPANY_ID, quoteMode: "KEENER_LOGISTICS" };
  }
  return { companyId: OAT_COMPANY_ID, quoteMode: "OAT_DIRECT" };
}
