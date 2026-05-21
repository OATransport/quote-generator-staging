import type { FeeType, Prisma } from "@prisma/client";

export const defaultQuoteFees: Array<{
  feeType: FeeType;
  label: string;
  showOnPdf: boolean;
  isInternalOnly: boolean;
  sortOrder: number;
}> = [
  { feeType: "CARRIER_PAY", label: "Carrier Pay", showOnPdf: false, isInternalOnly: true, sortOrder: 10 },
  { feeType: "BROKER_FEE", label: "Broker Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 20 },
  { feeType: "FUEL_SURCHARGE", label: "Fuel Surcharge", showOnPdf: true, isInternalOnly: false, sortOrder: 30 },
  { feeType: "INOPERABLE_FEE", label: "Inoperable Vehicle Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 40 },
  { feeType: "ENCLOSED_FEE", label: "Enclosed Trailer Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 50 },
  { feeType: "OVERSIZED_FEE", label: "Oversized Vehicle Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 60 },
  { feeType: "EXPEDITED_FEE", label: "Expedited Pickup Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 70 },
  { feeType: "STORAGE_FEE", label: "Storage Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 80 },
  { feeType: "RESIDENTIAL_PICKUP_FEE", label: "Residential Pickup Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 90 },
  { feeType: "HARD_TO_ACCESS_LOCATION_FEE", label: "Hard-to-Access Location Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 100 },
  { feeType: "DISCOUNT", label: "Discount", showOnPdf: true, isInternalOnly: false, sortOrder: 110 },
  { feeType: "CUSTOM", label: "Custom Fee", showOnPdf: true, isInternalOnly: false, sortOrder: 120 },
];

export type EditableQuoteFee = {
  feeType: FeeType;
  label: string;
  amount: number | Prisma.Decimal;
  isEnabled: boolean;
  showOnPdf: boolean;
  isInternalOnly: boolean;
  internalNote: string | null;
  sortOrder: number;
};

export function signedFeeAmount(fee: Pick<EditableQuoteFee, "feeType" | "amount">) {
  const amount = Number(fee.amount);
  return fee.feeType === "DISCOUNT" ? -Math.abs(amount) : amount;
}

export function calculateFeeTotals(fees: Array<Pick<EditableQuoteFee, "feeType" | "amount" | "isEnabled" | "isInternalOnly">>) {
  const enabledFees = fees.filter((fee) => fee.isEnabled);
  const customerTotal = enabledFees
    .filter((fee) => !fee.isInternalOnly)
    .reduce((sum, fee) => sum + signedFeeAmount(fee), 0);
  const carrierPay = enabledFees
    .filter((fee) => fee.feeType === "CARRIER_PAY")
    .reduce((sum, fee) => sum + Math.abs(Number(fee.amount)), 0);
  const internalOnlyTotal = enabledFees
    .filter((fee) => fee.isInternalOnly)
    .reduce((sum, fee) => sum + signedFeeAmount(fee), 0);

  return {
    customerTotal: Math.max(0, customerTotal),
    carrierPay,
    internalOnlyTotal,
    grossMargin: customerTotal - carrierPay,
    marginPercentage: customerTotal > 0 ? ((customerTotal - carrierPay) / customerTotal) * 100 : null,
  };
}
