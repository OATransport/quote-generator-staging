import {
  leadImportFields,
  quoteResultFields,
  type MappingField,
} from "@/lib/ghl-field-mapping-config";

export type GhlMappingDirection = "ghl-to-app" | "app-to-ghl";

export type GhlFieldIndicator =
  | "critical"
  | "optional"
  | "live-link-primary"
  | "pdf-optional"
  | "customer-facing"
  | "internal-only"
  | "read-from-ghl"
  | "written-to-ghl";

export type MappingFieldMeta = MappingField & {
  direction: GhlMappingDirection;
  indicators: GhlFieldIndicator[];
  notes?: string;
  safeToEdit: "mapping-and-fallback" | "mapping-only" | "avoid-unless-needed";
};

const CUSTOMER_FACING_RESULT_KEYS = new Set([
  "quoteTotal",
  "depositDue",
  "balanceDue",
  "quoteAcceptanceUrl",
  "quotePdfUrl",
  "quoteExpirationDate",
]);

const FIELD_NOTES: Partial<Record<string, string>> = {
  quoteAcceptanceUrl:
    "Primary customer link. Send this live quote URL to customers — it works even when no PDF exists.",
  quotePdfUrl:
    "Optional supporting document. Missing PDF URLs are fine; live quote links are the primary customer experience.",
  customerName: "Used to identify the customer on import and in quote headers.",
  customerEmail: "Fallback paths like contact.email are common when the custom field is empty.",
  customerPhone: "Fallback paths like contact.phone are common when the custom field is empty.",
  vehicleMake: "Required for a usable vehicle summary on import.",
  vehicleModel: "Required for a usable vehicle summary on import.",
  quoteNumber: "Written back so GHL opportunity records show the app quote ID.",
  quoteStatus: "Written back to reflect draft, sent, accepted, or declined status in GHL.",
  quoteTotal: "Customer-facing total written back to GHL when manual sync runs.",
};

function baseIndicators(field: MappingField): GhlFieldIndicator[] {
  if (field.key === "quoteAcceptanceUrl") {
    return ["critical", "live-link-primary", "written-to-ghl", "customer-facing"];
  }
  if (field.key === "quotePdfUrl") {
    return ["optional", "pdf-optional", "written-to-ghl"];
  }

  const indicators: GhlFieldIndicator[] = field.resultField ? ["written-to-ghl"] : ["read-from-ghl"];
  indicators.push(field.critical ? "critical" : "optional");

  if (field.resultField) {
    if (CUSTOMER_FACING_RESULT_KEYS.has(field.key)) {
      indicators.push("customer-facing");
    } else {
      indicators.push("internal-only");
    }
  }

  return indicators;
}

function enrichField(field: MappingField, direction: GhlMappingDirection): MappingFieldMeta {
  return {
    ...field,
    direction,
    indicators: baseIndicators(field),
    notes: FIELD_NOTES[field.key],
    safeToEdit: field.resultField ? "mapping-only" : "mapping-and-fallback",
  };
}

export const leadImportFieldMeta: MappingFieldMeta[] = leadImportFields.map((field) =>
  enrichField(field, "ghl-to-app"),
);

export const quoteResultFieldMeta: MappingFieldMeta[] = quoteResultFields.map((field) =>
  enrichField(field, "app-to-ghl"),
);

export const allMappingFieldMeta: MappingFieldMeta[] = [...leadImportFieldMeta, ...quoteResultFieldMeta];

export const mappingFieldMetaByKey = new Map(allMappingFieldMeta.map((field) => [field.key, field]));

export function directionLabel(direction: GhlMappingDirection) {
  return direction === "ghl-to-app" ? "GHL → App" : "App → GHL";
}

export function requiredLabel(field: MappingFieldMeta) {
  return field.indicators.includes("critical") ? "Required" : "Optional";
}
