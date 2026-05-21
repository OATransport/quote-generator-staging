export type QuotePricingNumbers = {
  customerPrice: number;
  depositDue: number;
  balanceDue: number;
  carrierPay: number;
  brokerFee: number;
  marginPercent: number | null;
};

export function calculateQuotePricing(input: {
  customerPrice: number;
  depositDue: number;
  carrierPay: number;
}): QuotePricingNumbers {
  const customerPrice = Math.max(0, input.customerPrice);
  const depositDue = Math.max(0, input.depositDue);
  const carrierPay = Math.max(0, input.carrierPay);
  const balanceDue = Math.max(0, customerPrice - depositDue);
  const brokerFee = customerPrice - carrierPay;
  const marginPercent = customerPrice > 0 ? (brokerFee / customerPrice) * 100 : null;

  return {
    customerPrice,
    depositDue,
    balanceDue,
    carrierPay,
    brokerFee,
    marginPercent,
  };
}

export const BREAKDOWN_META_LABEL = "__itemized_breakdown_toggle__";

export function isBreakdownMetaFee(fee: { label: string }) {
  return fee.label === BREAKDOWN_META_LABEL;
}

export function readShowItemizedBreakdown(
  fees: Array<{ label: string; isEnabled: boolean }>,
) {
  return fees.find(isBreakdownMetaFee)?.isEnabled ?? false;
}

export function sumCustomerBreakdownTotal(
  fees: Array<{ label: string; amount: number | string; isInternalOnly: boolean; isCustomerVisible: boolean }>,
) {
  return fees
    .filter((fee) => !isBreakdownMetaFee(fee) && fee.isCustomerVisible && !fee.isInternalOnly)
    .reduce((sum, fee) => sum + Number(fee.amount), 0);
}

export function breakdownMatchesCustomerPrice(breakdownTotal: number, customerPrice: number) {
  if (breakdownTotal <= 0) return true;
  return Math.abs(breakdownTotal - customerPrice) < 0.01;
}
