import type { GhlFieldMapping } from "@prisma/client";
import { knownGhlFieldRefForLocation } from "@/lib/ghl-known-field-ids";
import type { MappingFieldMeta } from "@/lib/ghl-field-mapping-meta";

export type MappingDisplayStatus = {
  label: string;
  tone: "ok" | "warn" | "muted" | "critical";
  helpText?: string;
};

export function effectiveKnownFallback(
  mapping: GhlFieldMapping | undefined,
  locationId: string,
  appFieldKey: string,
) {
  const known = knownGhlFieldRefForLocation(locationId, appFieldKey);
  return mapping?.fallbackPath ?? known?.fallbackPath ?? known?.ghlFieldKey ?? null;
}

export function effectiveKnownFieldId(
  mapping: GhlFieldMapping | undefined,
  locationId: string,
  appFieldKey: string,
) {
  const known = knownGhlFieldRefForLocation(locationId, appFieldKey);
  return mapping?.ghlCustomFieldId ?? known?.ghlCustomFieldId ?? null;
}

export function resolveMappingDisplayStatus(
  field: MappingFieldMeta,
  mapping: GhlFieldMapping | undefined,
  locationId: string,
): MappingDisplayStatus {
  const effectiveId = effectiveKnownFieldId(mapping, locationId, field.key);
  const effectiveFallback = effectiveKnownFallback(mapping, locationId, field.key);
  const isCritical = field.indicators.includes("critical");

  if (effectiveId) {
    return {
      label: isCritical ? "Mapped (critical)" : "Mapped",
      tone: "ok",
      helpText: effectiveFallback ? `Fallback key: ${effectiveFallback}` : undefined,
    };
  }

  if (effectiveFallback) {
    return {
      label: isCritical ? "Known key fallback" : "Uses known key fallback",
      tone: "ok",
      helpText: `Reads from ${effectiveFallback} when importing from GHL.`,
    };
  }

  if (mapping?.fallbackPath) {
    return {
      label: "Uses fallback",
      tone: "muted",
      helpText: "Reads from a JSON fallback path when the GHL custom field is empty.",
    };
  }

  if (isCritical) {
    return {
      label: "Missing critical mapping",
      tone: "critical",
      helpText: "This may prevent imports from filling route, customer, or vehicle data.",
    };
  }

  return {
    label: "Optional",
    tone: "muted",
    helpText: "Not required for a basic quote workflow.",
  };
}

export function isMappingEffectivelyMapped(
  field: MappingFieldMeta,
  mapping: GhlFieldMapping | undefined,
  locationId: string,
) {
  const status = resolveMappingDisplayStatus(field, mapping, locationId);
  return status.tone === "ok" || status.label === "Uses fallback";
}
