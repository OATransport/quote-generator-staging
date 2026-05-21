export function buildPublicQuoteTerms(input: {
  quoteMode: string;
  companyName: string;
  hasExpiration: boolean;
  depositDue?: import("@/lib/public-quote-deposit").MoneyLike;
}) {
  const isDirect = input.quoteMode === "OAT_DIRECT";
  const isBrokered = input.quoteMode === "OAT_IF_BROKERED" || input.quoteMode === "KEENER_LOGISTICS";
  const hasDeposit = Number(input.depositDue ?? 0) > 0;

  const lines = [
    hasDeposit
      ? "Deposit is due when accepting the quote."
      : "No deposit is due today unless otherwise noted.",
    "Balance is due on delivery unless otherwise noted.",
    "Pickup and delivery timing depends on carrier availability, route conditions, vehicle condition, and customer-provided details.",
    isBrokered ? "Carrier assignment and pickup timing are confirmed after dispatch." : null,
    isDirect ? "Pickup timing is confirmed after scheduling." : null,
    input.hasExpiration
      ? "Quote pricing may expire after the listed expiration date."
      : "Quote pricing may expire after the listed expiration date, if shown.",
    "Contact us before accepting if anything looks incorrect.",
  ].filter((line): line is string => Boolean(line));

  return lines;
}
