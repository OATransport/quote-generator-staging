import type { FeeType } from "@prisma/client";
import { calculateFeeTotals } from "@/lib/quote-fees";

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

export function formatRouteFromFormData(formData: FormData) {
  const pickup = [formData.get("pickupCity"), formData.get("pickupState")].filter(Boolean).join(", ") || "Pickup TBD";
  const delivery = [formData.get("deliveryCity"), formData.get("deliveryState")].filter(Boolean).join(", ") || "Delivery TBD";
  return `${pickup} → ${delivery}`;
}

export type QuoteFormPreview = {
  customerTotal: number;
  depositDue: number;
  balanceDue: number;
  carrierPay: number;
  grossMargin: number;
  marginPercentage: number | null;
  customerLineItems: Array<{ rowId: string; label: string; amount: number }>;
  internalLineItems: Array<{ rowId: string; label: string; amount: number }>;
  customerNotes: string;
  internalNotes: string;
  routeSummary: string;
};

export function buildPreviewFromFormData(formData: FormData): QuoteFormPreview {
  const fees = parseFeesFromFormData(formData);
  const totals = calculateFeeTotals(
    fees.map((fee) => ({
      feeType: fee.feeType as FeeType,
      amount: fee.amount,
      isEnabled: fee.isEnabled,
      isInternalOnly: fee.isInternalOnly,
    })),
  );
  const depositDue = Number(formData.get("depositDue") ?? 0);
  const balanceDue = Math.max(0, totals.customerTotal - depositDue);

  return {
    ...totals,
    depositDue,
    balanceDue,
    customerLineItems: fees
      .filter((fee) => fee.isEnabled && !fee.isInternalOnly)
      .map((fee) => ({ rowId: fee.rowId, label: fee.label, amount: fee.amount })),
    internalLineItems: fees
      .filter((fee) => fee.isEnabled && fee.isInternalOnly)
      .map((fee) => ({ rowId: fee.rowId, label: fee.label, amount: fee.amount })),
    customerNotes: String(formData.get("customerNotes") ?? ""),
    internalNotes: String(formData.get("internalNotes") ?? ""),
    routeSummary: formatRouteFromFormData(formData),
  };
}

export function buildPreviewFromFormElement(form: HTMLFormElement): QuoteFormPreview {
  return buildPreviewFromFormData(new FormData(form));
}

export function buildInitialPreview(input: {
  fees: QuoteFeeRowData[];
  depositDue: number;
  customerNotes: string;
  internalNotes: string;
  routeSummary: string;
}): QuoteFormPreview {
  const totals = calculateFeeTotals(
    input.fees.map((fee) => ({
      feeType: fee.feeType as FeeType,
      amount: fee.amount,
      isEnabled: fee.isEnabled,
      isInternalOnly: fee.isInternalOnly,
    })),
  );
  const balanceDue = Math.max(0, totals.customerTotal - input.depositDue);
  return {
    ...totals,
    depositDue: input.depositDue,
    balanceDue,
    customerLineItems: input.fees
      .filter((fee) => fee.isEnabled && !fee.isInternalOnly)
      .map((fee) => ({ rowId: getFeeRowId(fee), label: fee.label, amount: fee.amount })),
    internalLineItems: input.fees
      .filter((fee) => fee.isEnabled && fee.isInternalOnly)
      .map((fee) => ({ rowId: getFeeRowId(fee), label: fee.label, amount: fee.amount })),
    customerNotes: input.customerNotes,
    internalNotes: input.internalNotes,
    routeSummary: input.routeSummary,
  };
}
