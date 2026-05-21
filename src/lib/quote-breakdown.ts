import { currency } from "@/lib/utils";
import { isBreakdownMetaFee } from "@/lib/quote-pricing";

export type BreakdownMode = "simple" | "itemized";

export type BreakdownFeeLike = {
  label: string;
  amount: number | string;
  feeType?: string;
  isInternalOnly?: boolean;
  showOnPdf?: boolean;
  isEnabled?: boolean;
};

export function breakdownModeFromToggle(showItemizedBreakdown: boolean): BreakdownMode {
  return showItemizedBreakdown ? "itemized" : "simple";
}

export function isCustomerBreakdownFee(fee: BreakdownFeeLike) {
  return !isBreakdownMetaFee(fee) && !fee.isInternalOnly && fee.showOnPdf !== false;
}

export function sumCustomerBreakdownFees(fees: BreakdownFeeLike[]) {
  return fees
    .filter((fee) => fee.feeType === "CUSTOM" || fee.feeType === undefined)
    .filter(isCustomerBreakdownFee)
    .reduce((sum, fee) => sum + Number(fee.amount), 0);
}

export function breakdownRemainingAmount(customerPrice: number, breakdownTotal: number) {
  return Math.round((customerPrice - breakdownTotal) * 100) / 100;
}

export function breakdownMatchesCustomerPrice(breakdownTotal: number, customerPrice: number) {
  if (breakdownTotal <= 0) return customerPrice <= 0 || breakdownTotal === 0;
  return Math.abs(breakdownTotal - customerPrice) < 0.01;
}

export function formatBreakdownMismatchMessage(customerPrice: number, breakdownTotal: number) {
  const remaining = breakdownRemainingAmount(customerPrice, breakdownTotal);
  if (Math.abs(remaining) < 0.01) return null;
  if (remaining > 0) {
    return `Breakdown total is ${currency(breakdownTotal)}, but Transportation Service Price is ${currency(customerPrice)}. Add ${currency(remaining)} or update the service price.`;
  }
  return `Breakdown total is ${currency(breakdownTotal)}, but Transportation Service Price is ${currency(customerPrice)}. Reduce breakdown lines by ${currency(Math.abs(remaining))} or update the service price.`;
}

export function getPublicBreakdownItems(
  fees: Array<{
    id?: string;
    feeType: string;
    label: string;
    amount: { toString(): string } | number | string;
    isInternalOnly: boolean;
    showOnPdf: boolean;
  }>,
  itemizedMode: boolean,
) {
  if (!itemizedMode) return [];
  return fees.filter(
    (fee) =>
      fee.feeType === "CUSTOM" &&
      !isBreakdownMetaFee(fee) &&
      !fee.isInternalOnly &&
      fee.showOnPdf,
  );
}

export const BASE_TRANSPORT_LINE_LABEL = "Base Transport";
