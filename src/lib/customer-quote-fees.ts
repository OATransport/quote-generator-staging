import { calculateFeeTotals, type EditableQuoteFee } from "@/lib/quote-fees";

type CustomerFeeLike = {
  feeType: string;
  amount: number | EditableQuoteFee["amount"];
  isEnabled: boolean;
  isInternalOnly: boolean;
  showOnPdf?: boolean;
};

export function isCustomerFacingFee(fee: Pick<EditableQuoteFee, "isInternalOnly">) {
  return !fee.isInternalOnly;
}

export function feeAddsToCustomerTotal(fee: CustomerFeeLike) {
  return fee.isEnabled && isCustomerFacingFee(fee);
}

export function feeShowsOnCustomerQuote(fee: CustomerFeeLike) {
  return isCustomerFacingFee(fee) && (fee.isEnabled || fee.showOnPdf);
}

export function sumCustomerFeeTotal(
  fees: Array<Pick<EditableQuoteFee, "feeType" | "amount" | "isEnabled" | "isInternalOnly">>,
) {
  return calculateFeeTotals(fees).customerTotal;
}

export function resolveCustomerQuoteTotal(
  fees: Array<Pick<EditableQuoteFee, "feeType" | "amount" | "isEnabled" | "isInternalOnly">>,
  manualTotal?: number | null,
) {
  const calculated = sumCustomerFeeTotal(fees);
  if (manualTotal != null && Number.isFinite(manualTotal) && manualTotal >= 0) {
    if (calculated > 0) return Math.max(calculated, manualTotal);
    return manualTotal;
  }
  return calculated;
}

export function getCustomerQuoteLineItems<T extends CustomerFeeLike & { label: string }>(fees: T[]) {
  return fees
    .filter((fee) => feeShowsOnCustomerQuote(fee))
    .map((fee) => ({
      label: fee.label,
      amount: Number(fee.amount),
      addsToTotal: feeAddsToCustomerTotal(fee),
      feeType: fee.feeType,
    }));
}

export function getFeeRowHelperText(fee: CustomerFeeLike) {
  if (fee.isInternalOnly) {
    return fee.feeType === "CARRIER_PAY"
      ? "Used for dispatch/carrier negotiation. Not shown on the customer quote."
      : "Internal cost only. Not shown on the customer quote.";
  }
  if (fee.isEnabled) {
    return "Adds to customer quote total and can appear on the live customer quote.";
  }
  if (fee.showOnPdf) {
    return "Shown on the customer quote for reference only. Does not affect the quote total.";
  }
  return "Disabled. This line item is hidden from the customer quote.";
}
