import type { FeeType } from "@prisma/client";
import { calculateFeeTotals } from "@/lib/quote-fees";
import { feeAddsToCustomerTotal, feeShowsOnCustomerQuote } from "@/lib/customer-quote-fees";
import { formatRouteSummaryShort } from "@/lib/route-format";

export type QuoteFeeRowData = {
  id?: string;
  feeType: string;
  label: string;
  amount: number;
  isEnabled: boolean;
  showOnPdf: boolean;
  isInternalOnly: boolean;
  internalNote: string | null;
  sortOrder: number;
};

export type ParsedFormFee = QuoteFeeRowData & { rowId: string };

export function getFeeRowId(fee: Pick<QuoteFeeRowData, "id" | "feeType">) {
  return fee.id ?? `default-${fee.feeType}`;
}

export function parseFeesFromFormData(formData: FormData): ParsedFormFee[] {
  const rowIds = formData.getAll("feeRowId").map(String);
  const enabled = new Set(formData.getAll("feeEnabled").map(String));
  const showOnPdf = new Set(formData.getAll("feeShowOnPdf").map(String));
  const internalOnly = new Set(formData.getAll("feeInternalOnly").map(String));

  return rowIds.map((rowId) => {
    const feeType = String(formData.get(`feeType_${rowId}`) ?? "CUSTOM");
    const label = String(formData.get(`feeLabel_${rowId}`) ?? "").trim();
    return {
      rowId,
      feeType,
      label: label || "Custom Fee",
      amount: Number(formData.get(`feeAmount_${rowId}`) ?? 0),
      isEnabled: enabled.has(rowId),
      showOnPdf: showOnPdf.has(rowId),
      isInternalOnly: internalOnly.has(rowId),
      internalNote: String(formData.get(`feeInternalNote_${rowId}`) ?? "") || null,
      sortOrder: Number(formData.get(`feeSortOrder_${rowId}`) ?? 0),
    };
  });
}

export function parseCustomerQuoteTotal(formData: FormData, calculatedTotal: number) {
  const raw = formData.get("customerQuoteTotal");
  if (raw == null || raw === "") return calculatedTotal;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return calculatedTotal;
  return parsed;
}

export type QuoteFormPreview = {
  customerTotal: number;
  depositDue: number;
  balanceDue: number;
  carrierPay: number;
  grossMargin: number;
  marginPercentage: number | null;
  calculatedCustomerTotal: number;
  customerLineItems: Array<{ rowId: string; label: string; amount: number; addsToTotal: boolean }>;
  internalLineItems: Array<{ rowId: string; label: string; amount: number }>;
  customerNotes: string;
  internalNotes: string;
  routeSummary: string;
};

function buildPreviewCore(input: {
  fees: ParsedFormFee[] | QuoteFeeRowData[];
  depositDue: number;
  customerQuoteTotal?: number | null;
  customerNotes: string;
  internalNotes: string;
  routeSummary: string;
}): QuoteFormPreview {
  const feeInputs = input.fees.map((fee) => ({
    feeType: fee.feeType as FeeType,
    amount: fee.amount,
    isEnabled: fee.isEnabled,
    isInternalOnly: fee.isInternalOnly,
    showOnPdf: fee.showOnPdf,
    label: fee.label,
    rowId: "rowId" in fee ? fee.rowId : getFeeRowId(fee),
  }));

  const totals = calculateFeeTotals(feeInputs);
  const customerTotal =
    input.customerQuoteTotal != null && input.customerQuoteTotal >= 0
      ? input.customerQuoteTotal
      : totals.customerTotal;
  const depositDue = input.depositDue;
  const balanceDue = Math.max(0, customerTotal - depositDue);
  const grossMargin = customerTotal - totals.carrierPay;
  const marginPercentage = customerTotal > 0 ? (grossMargin / customerTotal) * 100 : null;

  return {
    customerTotal,
    calculatedCustomerTotal: totals.customerTotal,
    depositDue,
    balanceDue,
    carrierPay: totals.carrierPay,
    grossMargin,
    marginPercentage,
    customerLineItems: feeInputs
      .filter((fee) => feeShowsOnCustomerQuote(fee))
      .map((fee) => ({
        rowId: fee.rowId,
        label: fee.label,
        amount: fee.amount,
        addsToTotal: feeAddsToCustomerTotal(fee),
      })),
    internalLineItems: feeInputs
      .filter((fee) => fee.isEnabled && fee.isInternalOnly)
      .map((fee) => ({ rowId: fee.rowId, label: fee.label, amount: fee.amount })),
    customerNotes: input.customerNotes,
    internalNotes: input.internalNotes,
    routeSummary: input.routeSummary,
  };
}

export function buildPreviewFromFormData(formData: FormData): QuoteFormPreview {
  const fees = parseFeesFromFormData(formData);
  const calculated = calculateFeeTotals(
    fees.map((fee) => ({
      feeType: fee.feeType as FeeType,
      amount: fee.amount,
      isEnabled: fee.isEnabled,
      isInternalOnly: fee.isInternalOnly,
    })),
  );
  const customerQuoteTotal = parseCustomerQuoteTotal(formData, calculated.customerTotal);
  const depositDue = Number(formData.get("depositDue") ?? 0);

  return buildPreviewCore({
    fees,
    depositDue,
    customerQuoteTotal,
    customerNotes: String(formData.get("customerNotes") ?? ""),
    internalNotes: String(formData.get("internalNotes") ?? ""),
    routeSummary: formatRouteSummaryShort(
      String(formData.get("pickupCity") ?? ""),
      String(formData.get("pickupState") ?? ""),
      String(formData.get("deliveryCity") ?? ""),
      String(formData.get("deliveryState") ?? ""),
    ),
  });
}

export function buildPreviewFromFormElement(form: HTMLFormElement): QuoteFormPreview {
  return buildPreviewFromFormData(new FormData(form));
}

export function buildInitialPreview(input: {
  fees: QuoteFeeRowData[];
  customerTotal: number;
  depositDue: number;
  customerNotes: string;
  internalNotes: string;
  routeSummary: string;
}): QuoteFormPreview {
  const calculated = calculateFeeTotals(
    input.fees.map((fee) => ({
      feeType: fee.feeType as FeeType,
      amount: fee.amount,
      isEnabled: fee.isEnabled,
      isInternalOnly: fee.isInternalOnly,
    })),
  );
  const customerQuoteTotal =
    calculated.customerTotal > 0 ? calculated.customerTotal : Math.max(0, input.customerTotal);

  return buildPreviewCore({
    fees: input.fees,
    depositDue: input.depositDue,
    customerQuoteTotal,
    customerNotes: input.customerNotes,
    internalNotes: input.internalNotes,
    routeSummary: input.routeSummary,
  });
}
