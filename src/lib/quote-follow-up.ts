/**
 * Simple follow-up heuristics for dispatch workflow.
 *
 * A quote needs follow-up when any of:
 * - Status is QUESTION (customer asked a question)
 * - Status is DECLINED (may need outreach or re-quote)
 * - Customer total is zero (imported but not priced)
 * - Active quote not updated in 7+ days (stale draft/work-in-progress)
 */
export function getQuoteFollowUpReasons(quote: {
  status: string;
  customerTotal: number | { toString(): string };
  updatedAt: Date;
  archivedAt?: Date | null;
}): string[] {
  if (quote.archivedAt) return [];

  const reasons: string[] = [];
  const total = Number(quote.customerTotal);
  const terminalStatuses = new Set(["ACCEPTED", "DECLINED", "CANCELLED"]);

  if (quote.status === "QUESTION") reasons.push("Customer question");
  if (quote.status === "DECLINED") reasons.push("Declined — follow up");
  if (total <= 0) reasons.push("No pricing / total");

  const daysSinceUpdate = (Date.now() - quote.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate >= 7 && !terminalStatuses.has(quote.status)) {
    reasons.push("Not updated in 7+ days");
  }

  return reasons;
}

export function quoteNeedsFollowUp(quote: Parameters<typeof getQuoteFollowUpReasons>[0]) {
  return getQuoteFollowUpReasons(quote).length > 0;
}
