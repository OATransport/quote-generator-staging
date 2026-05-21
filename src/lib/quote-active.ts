import type { Quote, QuoteStatus } from "@prisma/client";

const INACTIVE_STATUSES: QuoteStatus[] = ["CANCELLED", "EXPIRED"];

export function isQuotePubliclyActive(quote: Pick<Quote, "archivedAt" | "status">) {
  if (quote.archivedAt) return false;
  if (INACTIVE_STATUSES.includes(quote.status)) return false;
  return true;
}
