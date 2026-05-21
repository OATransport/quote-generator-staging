import type { FeeType } from "@prisma/client";
import {
  breakdownMatchesCustomerPrice,
  calculateQuotePricing,
  isBreakdownMetaFee,
  sumCustomerBreakdownTotal,
} from "@/lib/quote-pricing";
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

export function getFeeRowId(fee: Pick<QuoteFeeRowData, "id" | "feeType" | "label">) {
  if (isBreakdownMetaFee(fee)) return "breakdown-meta";
  return fee.id ?? `default-${fee.feeType}`;
}

export function parseFeesFromFormData(formData: FormData): ParsedFormFee[] {
  const rowIds = formData.getAll("feeRowId").map(String);
  const customerVisible = new Set(formData.getAll("feeCustomerVisible").map(String));
  const internalOnly = new Set(formData.getAll("feeInternalOnly").map(String));

  return rowIds.map((rowId) => {
    const feeType = String(formData.get(`feeType_${rowId}`) ?? "CUSTOM");
    const label = String(formData.get(`feeLabel_${rowId}`) ?? "").trim();
    const isInternal = internalOnly.has(rowId);
    const isCustomerVisible = customerVisible.has(rowId);
    return {
      rowId,
      feeType,
      label: label || "Line item",
      amount: Number(formData.get(`feeAmount_${rowId}`) ?? 0),
      isEnabled: true,
      showOnPdf: isCustomerVisible,
      isInternalOnly: isInternal,
      internalNote: String(formData.get(`feeInternalNote_${rowId}`) ?? "") || null,
      sortOrder: Number(formData.get(`feeSortOrder_${rowId}`) ?? 0),
    };
  });
}

export type QuoteFormPreview = {
  customerTotal: number;
  depositDue: number;
  balanceDue: number;
  carrierPay: number;
  grossMargin: number;
  marginPercentage: number | null;
  showItemizedBreakdown: boolean;
  breakdownTotal: number;
  breakdownMatchesPrice: boolean;
  breakdownLineItems: Array<{ rowId: string; label: string; amount: number; isCustomerVisible: boolean }>;
  customerNotes: string;
  internalNotes: string;
  carrierNotes: string;
  routeSummary: string;
};

function parseMoneyField(formData: FormData, key: string, fallback = 0) {
  const raw = formData.get(key);
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildPreviewCore(input: {
  fees: ParsedFormFee[] | QuoteFeeRowData[];
  customerPrice: number;
  depositDue: number;
  carrierPay: number;
  showItemizedBreakdown: boolean;
  customerNotes: string;
  internalNotes: string;
  carrierNotes: string;
  routeSummary: string;
}): QuoteFormPreview {
  const breakdownFees = input.fees
    .filter((fee) => !isBreakdownMetaFee(fee) && fee.feeType === "CUSTOM")
    .map((fee) => ({
      rowId: ("rowId" in fee ? fee.rowId : getFeeRowId(fee)) as string,
      label: fee.label,
      amount: Number(fee.amount),
      isCustomerVisible: fee.showOnPdf && !fee.isInternalOnly,
      isInternalOnly: fee.isInternalOnly,
    }));

  const breakdownTotal = sumCustomerBreakdownTotal(breakdownFees);
  const pricing = calculateQuotePricing({
    customerPrice: input.customerPrice,
    depositDue: input.depositDue,
    carrierPay: input.carrierPay,
  });

  return {
    customerTotal: pricing.customerPrice,
    depositDue: pricing.depositDue,
    balanceDue: pricing.balanceDue,
    carrierPay: pricing.carrierPay,
    grossMargin: pricing.brokerFee,
    marginPercentage: pricing.marginPercent,
    showItemizedBreakdown: input.showItemizedBreakdown,
    breakdownTotal,
    breakdownMatchesPrice: breakdownMatchesCustomerPrice(breakdownTotal, pricing.customerPrice),
    breakdownLineItems: breakdownFees.map((fee) => ({
      rowId: fee.rowId,
      label: fee.label,
      amount: fee.amount,
      isCustomerVisible: fee.isCustomerVisible,
    })),
    customerNotes: input.customerNotes,
    internalNotes: input.internalNotes,
    carrierNotes: input.carrierNotes,
    routeSummary: input.routeSummary,
  };
}

export function buildPreviewFromFormData(formData: FormData): QuoteFormPreview {
  const fees = parseFeesFromFormData(formData);
  const showItemizedBreakdown = formData.get("showItemizedBreakdown") === "on";

  return buildPreviewCore({
    fees,
    customerPrice: parseMoneyField(formData, "customerTransportationPrice"),
    depositDue: parseMoneyField(formData, "depositDue"),
    carrierPay: parseMoneyField(formData, "carrierPay"),
    showItemizedBreakdown,
    customerNotes: String(formData.get("customerNotes") ?? ""),
    internalNotes: String(formData.get("internalNotes") ?? ""),
    carrierNotes: String(formData.get("carrierNotes") ?? ""),
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
  carrierPay: number;
  showItemizedBreakdown: boolean;
  customerNotes: string;
  internalNotes: string;
  carrierNotes: string;
  routeSummary: string;
}): QuoteFormPreview {
  return buildPreviewCore({
    fees: input.fees,
    customerPrice: input.customerTotal,
    depositDue: input.depositDue,
    carrierPay: input.carrierPay,
    showItemizedBreakdown: input.showItemizedBreakdown,
    customerNotes: input.customerNotes,
    internalNotes: input.internalNotes,
    carrierNotes: input.carrierNotes,
    routeSummary: input.routeSummary,
  });
}

export function breakdownFeesFromQuoteFees(fees: QuoteFeeRowData[]) {
  return fees.filter((fee) => fee.feeType === "CUSTOM" && !isBreakdownMetaFee(fee));
}

export function buildFeeRowsForSave(input: {
  breakdownFees: ParsedFormFee[];
  showItemizedBreakdown: boolean;
  carrierPay: number;
  carrierNotes: string | null;
}) {
  const rows: Array<{
    feeType: FeeType;
    label: string;
    amount: number;
    isEnabled: boolean;
    showOnPdf: boolean;
    isInternalOnly: boolean;
    internalNote: string | null;
    sortOrder: number;
  }> = [];

  rows.push({
    feeType: "CARRIER_PAY",
    label: "Carrier Pay",
    amount: input.carrierPay,
    isEnabled: input.carrierPay > 0,
    showOnPdf: false,
    isInternalOnly: true,
    internalNote: input.carrierNotes,
    sortOrder: 10,
  });

  rows.push({
    feeType: "CUSTOM",
    label: "__itemized_breakdown_toggle__",
    amount: 0,
    isEnabled: input.showItemizedBreakdown,
    showOnPdf: false,
    isInternalOnly: true,
    internalNote: null,
    sortOrder: 15,
  });

  input.breakdownFees
    .filter((fee) => !isBreakdownMetaFee(fee) && (fee.label || fee.amount !== 0))
    .forEach((fee, index) => {
      rows.push({
        feeType: "CUSTOM",
        label: fee.label || "Line item",
        amount: fee.amount,
        isEnabled: true,
        showOnPdf: fee.showOnPdf && input.showItemizedBreakdown,
        isInternalOnly: fee.isInternalOnly,
        internalNote: fee.internalNote,
        sortOrder: 100 + index,
      });
    });

  return rows;
}
