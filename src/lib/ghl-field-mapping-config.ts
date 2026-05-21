export type MappingField = {
  key: string;
  label: string;
  critical?: boolean;
  resultField?: boolean;
  createDataType?: "TEXT" | "NUMERICAL" | "DATE";
};

export const leadImportFields: MappingField[] = [
  { key: "customerName", label: "Customer name", critical: true },
  { key: "customerPhone", label: "Customer phone", critical: true },
  { key: "customerEmail", label: "Customer email", critical: true },
  { key: "pickupAddress", label: "Pickup address" },
  { key: "pickupCity", label: "Pickup city", critical: true },
  { key: "pickupState", label: "Pickup state", critical: true },
  { key: "pickupZip", label: "Pickup ZIP" },
  { key: "pickupContactName", label: "Pickup contact name" },
  { key: "pickupContactPhone", label: "Pickup contact phone" },
  { key: "deliveryAddress", label: "Delivery address" },
  { key: "deliveryCity", label: "Delivery city", critical: true },
  { key: "deliveryState", label: "Delivery state", critical: true },
  { key: "deliveryZip", label: "Delivery ZIP" },
  { key: "deliveryContactName", label: "Delivery contact name" },
  { key: "deliveryContactPhone", label: "Delivery contact phone" },
  { key: "pickupDate", label: "Pickup date" },
  { key: "deliveryWindow", label: "Delivery window" },
  { key: "vehicleYear", label: "Vehicle year" },
  { key: "vehicleMake", label: "Vehicle make", critical: true },
  { key: "vehicleModel", label: "Vehicle model", critical: true },
  { key: "vehicleType", label: "Vehicle type" },
  { key: "vehicleCondition", label: "Vehicle condition" },
  { key: "vehicleVin", label: "Vehicle VIN" },
  { key: "trailerType", label: "Trailer type" },
];

export const quoteResultFields: MappingField[] = [
  { key: "quoteNumber", label: "Quote Number", resultField: true, critical: true, createDataType: "TEXT" },
  { key: "quoteMode", label: "Quote Mode", resultField: true, createDataType: "TEXT" },
  { key: "quoteStatus", label: "Quote Status", resultField: true, critical: true, createDataType: "TEXT" },
  { key: "quoteTotal", label: "Quote Total", resultField: true, critical: true, createDataType: "NUMERICAL" },
  { key: "depositDue", label: "Deposit Due", resultField: true, createDataType: "NUMERICAL" },
  { key: "balanceDue", label: "Balance Due", resultField: true, createDataType: "NUMERICAL" },
  { key: "quotePdfUrl", label: "Quote PDF URL", resultField: true, createDataType: "TEXT" },
  { key: "quoteAcceptanceUrl", label: "Public Acceptance URL", resultField: true, critical: true, createDataType: "TEXT" },
  { key: "acceptedAt", label: "Accepted At", resultField: true, createDataType: "DATE" },
  { key: "declinedAt", label: "Declined At", resultField: true, createDataType: "DATE" },
  { key: "declineReason", label: "Decline Reason", resultField: true, createDataType: "TEXT" },
  { key: "latestCustomerQuestion", label: "Latest Customer Question", resultField: true, createDataType: "TEXT" },
  { key: "quoteExpirationDate", label: "Quote expiration date", resultField: true, createDataType: "DATE" },
];

export const allMappingFields = [...leadImportFields, ...quoteResultFields];

export const quoteResultFieldNames: Record<string, string> = Object.fromEntries(
  quoteResultFields.map((field) => [field.key, field.label]),
);
