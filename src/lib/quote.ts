import type { Company, CustomerSnapshot, Quote, QuoteFee, VehicleSnapshot } from "@prisma/client";

export function nextQuoteNumber(prefix: string, count: number) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(count + 1).padStart(5, "0")}`;
}

export function calculateQuoteTotal(input: {
  transportPrice: number;
  brokerFee?: number;
  discount?: number;
  fees?: Array<{ selected: boolean; type: "FLAT" | "PERCENT"; amount: number }>;
}) {
  const subtotal = Number(input.transportPrice) + Number(input.brokerFee ?? 0);
  const feeTotal = (input.fees ?? []).reduce((sum, fee) => {
    if (!fee.selected) return sum;
    return sum + (fee.type === "PERCENT" ? subtotal * (Number(fee.amount) / 100) : Number(fee.amount));
  }, 0);
  return Math.max(0, subtotal + feeTotal - Number(input.discount ?? 0));
}

export type QuoteWithRelations = Quote & {
  company: Company;
  customerSnapshot: CustomerSnapshot;
  fees: QuoteFee[];
  vehicles: VehicleSnapshot[];
};

export function quoteModeLabel(mode: string) {
  const labels: Record<string, string> = {
    OAT_DIRECT: "OAT Direct Carrier Service",
    KEENER_LOGISTICS: "Keener Logistics Transport",
    OAT_IF_BROKERED: "OAT Brokered Transport",
  };
  return labels[mode] ?? mode;
}
