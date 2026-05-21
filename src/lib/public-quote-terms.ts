export function buildPublicQuoteTerms(input: {
  quoteMode: string;
  companyName: string;
  hasExpiration: boolean;
}) {
  const isDirect = input.quoteMode === "OAT_DIRECT";
  const isBrokered = input.quoteMode === "OAT_IF_BROKERED" || input.quoteMode === "KEENER_LOGISTICS";

  const lines = [
    "Deposit is due when accepting the quote.",
    "Remaining balance is due on delivery unless otherwise noted.",
    "Pickup and delivery timing depends on carrier availability, route conditions, vehicle condition, and customer-provided details.",
    isBrokered
      ? "If this is a brokered transport quote, dispatch timing depends on carrier acceptance."
      : null,
    isBrokered
      ? "Carrier assignment and pickup timing are confirmed after dispatch."
      : isDirect
        ? "Pickup timing is confirmed after scheduling."
        : "Dispatch timing is confirmed after scheduling.",
    input.hasExpiration
      ? "Quote pricing may expire after the listed expiration date."
      : "Quote pricing may expire after the listed expiration date, if shown.",
    "Contact us with questions before accepting if anything looks incorrect.",
  ].filter((line): line is string => Boolean(line));

  return lines;
}
