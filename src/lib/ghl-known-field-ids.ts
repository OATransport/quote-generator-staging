import { KEENER_GHL_LOCATION_ID, OAT_GHL_LOCATION_ID } from "@/lib/ghl-field-mappings";

export type KnownGhlFieldRef = {
  ghlCustomFieldId?: string;
  ghlCustomFieldName?: string;
  /** GHL unique key, e.g. contact.pickup_address */
  ghlFieldKey: string;
  /** Dot path used during import fallback resolution */
  fallbackPath?: string;
  /** Keener combined pickup/delivery location field */
  combinedLocation?: boolean;
  /** Keener combined make/model field */
  combinedMakeModel?: boolean;
  optional?: boolean;
};

function ref(
  ghlFieldKey: string,
  extras: Omit<KnownGhlFieldRef, "ghlFieldKey"> = {},
): KnownGhlFieldRef {
  return {
    ghlFieldKey,
    fallbackPath: extras.fallbackPath ?? ghlFieldKey,
    ...extras,
  };
}

export const OAT_KNOWN_GHL_FIELD_REFS: Record<string, KnownGhlFieldRef> = {
  pickupAddress: ref("contact.pickup_address", {
    ghlCustomFieldId: "VvTyXTc12g2WisAqYUmn",
    ghlCustomFieldName: "Pickup Address",
  }),
  pickupCity: ref("contact.pickup_city", {
    ghlCustomFieldId: "glKyM53bSnn7sW7Lv0jl",
    ghlCustomFieldName: "Pickup City",
  }),
  pickupState: ref("contact.pickup_state", {
    ghlCustomFieldId: "Mtqf3tMeZVpi4e9GOkZS",
    ghlCustomFieldName: "Pickup State",
  }),
  pickupZip: ref("contact.pickup_zip", {
    ghlCustomFieldId: "KbT8TNWuqkHd4XxQDbvH",
    ghlCustomFieldName: "Pickup Zip",
  }),
  deliveryAddress: ref("contact.delivery_address", {
    ghlCustomFieldId: "QnsLu8ZzbrEfbSHWE2QB",
    ghlCustomFieldName: "Delivery Address",
  }),
  deliveryCity: ref("contact.delivery_city", {
    ghlCustomFieldId: "bBrbyG5O7ZH9BePRDnOG",
    ghlCustomFieldName: "Delivery City",
  }),
  deliveryState: ref("contact.delivery_state", {
    ghlCustomFieldId: "tDXAuYSSxE8HqmmsciGa",
    ghlCustomFieldName: "Delivery State",
  }),
  deliveryZip: ref("contact.delivery_zip", {
    ghlCustomFieldId: "bleGDX8AlqDqvFDEQCBr",
    ghlCustomFieldName: "Delivery Zip",
  }),
  vehicleYear: ref("contact.vehicle_year", {
    ghlCustomFieldId: "YpKh1D0AjU1qFL9n2CAe",
    ghlCustomFieldName: "Vehicle Year",
  }),
  vehicleMake: ref("contact.vehicle_make", {
    ghlCustomFieldId: "T56wSkWRK6HK82sWPE8f",
    ghlCustomFieldName: "Vehicle Make",
  }),
  vehicleModel: ref("contact.vehicle_model", {
    ghlCustomFieldId: "oEdXx86c6J8GUPSMa4kB",
    ghlCustomFieldName: "Vehicle Model",
  }),
  vehicleType: ref("contact.vehicle_type", {
    ghlCustomFieldId: "CTrm9cVBlSRkeXAuB3Xf",
    ghlCustomFieldName: "Vehicle Type",
  }),
  vehicleIsRunning: ref("contact.vehicle_running", {
    ghlCustomFieldId: "aMa8w1jbTMaY2UghJHVo",
    ghlCustomFieldName: "Vehicle Running",
  }),
  pickupDate: ref("contact.pickup_date", {
    ghlCustomFieldId: "2MnOmIZN1M9nyyptqcth",
    ghlCustomFieldName: "Pickup Date",
  }),
  vehicleNotes: ref("contact.vehicles_summary", {
    ghlCustomFieldId: "pMAtV1VZEF7Ng0d0bs1s",
    ghlCustomFieldName: "Vehicles Summary",
  }),
  customerNotes: ref("contact.shipment_notes", {
    ghlCustomFieldId: "Vt55SEy4piwIfVoFNMDM",
    ghlCustomFieldName: "Shipment Notes",
  }),
  pickupFlexibility: ref("contact.pickup_flexibility", { optional: true }),
  customerType: ref("contact.customer_type", { optional: true }),
  utmSource: ref("contact.utm_source", { optional: true }),
  utmMedium: ref("contact.utm_medium", { optional: true }),
  utmCampaign: ref("contact.utm_campaign", { optional: true }),
  landingPageUrl: ref("contact.landing_page_url", { optional: true }),
  vehicleCount: ref("contact.vehicle_count", { optional: true }),
};

export const KEENER_KNOWN_GHL_FIELD_REFS: Record<string, KnownGhlFieldRef> = {
  customerCompanyName: ref("contact.company", { ghlCustomFieldName: "Company" }),
  preferredContactMethod: ref("contact.preferred_contact_method", { optional: true }),
  shipmentType: ref("contact.shipment_type", { optional: true }),
  customerNotes: ref("contact.shipment_notes", {
    ghlCustomFieldId: "YcqRVpA9kvEAUAVB5xsY",
    ghlCustomFieldName: "Shipment Notes",
  }),
  pickupContext: ref("contact.pickup_context", { optional: true }),
  includeSecondVehicle: ref("contact.include_second_vehicle", { optional: true }),
  trailerType: ref("contact.transport_type", {
    ghlCustomFieldId: "Agry63WIlcLHQ2jAvmjd",
    ghlCustomFieldName: "Transport Type",
  }),
  modificationsSpecialHandling: ref("contact.modifications_special_handling", { optional: true }),
  modificationNotes: ref("contact.modification_notes", { optional: true }),
  vehicleIsRunning: ref("contact.vehicle_running_status", {
    ghlCustomFieldId: "AyDUodjouO0CPR4ZY8Dj",
    ghlCustomFieldName: "Vehicle Running Status",
  }),
  pickupAddress: ref("contact.pickup_city", {
    ghlCustomFieldId: "t0TdRKz00XKKzA6aIgjO",
    ghlCustomFieldName: "Pickup Address",
    combinedLocation: true,
  }),
  deliveryAddress: ref("contact.delivery_city", {
    ghlCustomFieldId: "CHKKWx1l5Mbhxs5xmnH8",
    ghlCustomFieldName: "Delivery Address",
    combinedLocation: true,
  }),
  flexibleDates: ref("contact.flexible_dates", { optional: true }),
  preferredTimeframe: ref("contact.preferred_timeframe", { optional: true }),
  timingNotes: ref("contact.timing_notes", { optional: true }),
  additionalNotes: ref("contact.additional_notes", { optional: true }),
  vehicleYear: ref("contact.year_of_vehicle", {
    ghlCustomFieldId: "AMmGBshV0savlmaWF03S",
    ghlCustomFieldName: "Year of Vehicle",
  }),
  pickupDate: ref("contact.first_available_pickup_date", {
    ghlCustomFieldId: "XefAEWrwtmRYmFXL4sIN",
    ghlCustomFieldName: "First Available Pickup Date",
  }),
  vehicleMake: ref("contact.make_model", {
    combinedMakeModel: true,
    ghlCustomFieldName: "Make / Model",
  }),
  vehicleModel: ref("contact.make_model", {
    combinedMakeModel: true,
    ghlCustomFieldName: "Make / Model",
  }),
  vehicleNotes: ref("contact.quote_summary", {
    ghlCustomFieldId: "1qPem9ftvGIz9Jms8e1O",
    ghlCustomFieldName: "Quote Summary",
  }),
};

/** @deprecated Use knownGhlFieldRefsForLocation */
export const OAT_KNOWN_GHL_FIELD_IDS = OAT_KNOWN_GHL_FIELD_REFS;
/** @deprecated Use knownGhlFieldRefsForLocation */
export const KEENER_KNOWN_GHL_FIELD_IDS = KEENER_KNOWN_GHL_FIELD_REFS;

export function knownGhlFieldRefsForLocation(ghlLocationId: string): Record<string, KnownGhlFieldRef> {
  if (ghlLocationId === KEENER_GHL_LOCATION_ID) return KEENER_KNOWN_GHL_FIELD_REFS;
  if (ghlLocationId === OAT_GHL_LOCATION_ID) return OAT_KNOWN_GHL_FIELD_REFS;
  return {};
}

export function knownGhlFieldRefForLocation(ghlLocationId: string, appFieldKey: string) {
  return knownGhlFieldRefsForLocation(ghlLocationId)[appFieldKey];
}

/** @deprecated Use knownGhlFieldRefsForLocation */
export function knownGhlFieldIdsForLocation(ghlLocationId: string) {
  return knownGhlFieldRefsForLocation(ghlLocationId);
}

export function stripContactPrefix(fieldKey: string) {
  return fieldKey.startsWith("contact.") ? fieldKey.slice("contact.".length) : fieldKey;
}
