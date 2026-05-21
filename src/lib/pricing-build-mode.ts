import type { ParsedFormFee } from "@/lib/quote-form-preview";
import { sumCustomerBreakdownFees } from "@/lib/quote-breakdown";

export type PricingBuildMode = "simple" | "itemized";

export function pricingBuildModeFromForm(formData: FormData): PricingBuildMode {
  return formData.get("breakdownMode") === "itemized" ? "itemized" : "simple";
}

export function resolveCustomerTransportationPrice(input: {
  mode: PricingBuildMode;
  manualPrice: number;
  breakdownFees: ParsedFormFee[] | Array<{ feeType?: string; label: string; amount: number; isInternalOnly: boolean; showOnPdf: boolean }>;
}): number {
  if (input.mode === "itemized") {
    return sumCustomerBreakdownFees(
      input.breakdownFees.map((fee) => ({
        ...fee,
        feeType: fee.feeType ?? "CUSTOM",
      })),
    );
  }
  return Math.max(0, input.manualPrice);
}

export const CUSTOMER_LINE_PRESETS = [
  { label: "Base Transport", amount: 0 },
  { label: "Expedited Fee", amount: 0 },
  { label: "Inoperable Fee", amount: 0 },
  { label: "Enclosed Transport Upgrade", amount: 0 },
  { label: "Additional Vehicle", amount: 0 },
] as const;
