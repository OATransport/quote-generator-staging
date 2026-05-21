import type { QuoteMode } from "@prisma/client";

export type QuoteModelConfig = {
  mode: QuoteMode;
  title: string;
  shortTitle: string;
  description: string;
  customerServicePriceLabel: string;
  depositLabel: string;
  balanceDueLabel: string;
  balanceDueHelper: string;
  pricingCardDescription: string;
  showBrokerFormula: boolean;
  showCarrierPaySection: boolean;
  carrierPayLabel: string;
  carrierPayHelper: string;
  carrierSectionTitle: string;
  carrierSectionDescription: string;
  internalSectionTitle: string;
  internalSectionDescription: string;
  workspaceDescription: string;
};

export const QUOTE_MODELS: QuoteModelConfig[] = [
  {
    mode: "OAT_DIRECT",
    title: "OAT Direct Carrier Service",
    shortTitle: "OAT Direct",
    description: "Organized Auto Transport is providing direct carrier/service pricing.",
    customerServicePriceLabel: "Transportation Service Price",
    depositLabel: "Deposit Due Today",
    balanceDueLabel: "Balance Due on Delivery",
    balanceDueHelper: "Paid according to dispatch/payment terms unless otherwise noted.",
    pricingCardDescription: "Review your service price, deposit, and balance due on delivery.",
    showBrokerFormula: false,
    showCarrierPaySection: true,
    carrierPayLabel: "Internal operating / driver cost",
    carrierPayHelper: "Optional internal cost estimate. Not shown on the customer quote.",
    carrierSectionTitle: "Internal dispatch cost",
    carrierSectionDescription: "Optional operating cost for direct service quotes. Never shown publicly.",
    internalSectionTitle: "Internal margin view",
    internalSectionDescription: "Direct service margin math. Never shown on the public customer quote.",
    workspaceDescription:
      "Price direct carrier service: customer price, deposit, and balance due on delivery.",
  },
  {
    mode: "OAT_IF_BROKERED",
    title: "OAT Brokered Transport",
    shortTitle: "OAT Brokered",
    description: "OAT is brokering the load to a carrier.",
    customerServicePriceLabel: "Transportation Service Price",
    depositLabel: "Deposit Due Today",
    balanceDueLabel: "Balance Due on Delivery",
    balanceDueHelper: "Paid according to dispatch/payment terms unless otherwise noted.",
    pricingCardDescription: "Review your service price, deposit, and balance due on delivery.",
    showBrokerFormula: true,
    showCarrierPaySection: true,
    carrierPayLabel: "Carrier Pay / Driver Offer",
    carrierPayHelper: "What we expect to pay or offer the carrier. Not shown on the customer quote.",
    carrierSectionTitle: "Carrier offer format",
    carrierSectionDescription: "Used internally for dispatch and carrier negotiation. Not public to customers.",
    internalSectionTitle: "Internal profit view",
    internalSectionDescription: "Broker math only. Never shown on the public customer quote.",
    workspaceDescription:
      "Price brokered transport: customer price, carrier pay, and broker profit.",
  },
  {
    mode: "KEENER_LOGISTICS",
    title: "Keener Logistics Transport",
    shortTitle: "Keener Logistics",
    description: "Keener Logistics branded transportation quote.",
    customerServicePriceLabel: "Logistics Transportation Service",
    depositLabel: "Deposit Due Today",
    balanceDueLabel: "Balance Due on Delivery",
    balanceDueHelper: "Paid according to dispatch/payment terms unless otherwise noted.",
    pricingCardDescription: "Review your logistics service price, deposit, and balance due on delivery.",
    showBrokerFormula: true,
    showCarrierPaySection: true,
    carrierPayLabel: "Carrier Pay / Driver Offer",
    carrierPayHelper: "What we expect to pay or offer the carrier. Not shown on the customer quote.",
    carrierSectionTitle: "Carrier offer format",
    carrierSectionDescription: "Used internally for dispatch and carrier negotiation. Not public to customers.",
    internalSectionTitle: "Internal profit view",
    internalSectionDescription: "Broker math only. Never shown on the public customer quote.",
    workspaceDescription:
      "Price Keener logistics transport: customer price, carrier pay, and broker profit.",
  },
];

export function getQuoteModelConfig(mode: string | QuoteMode): QuoteModelConfig {
  return QUOTE_MODELS.find((model) => model.mode === mode) ?? QUOTE_MODELS[0];
}

export function resolveDefaultQuoteMode(input: {
  quoteMode: QuoteMode;
  companyName: string;
}): QuoteMode {
  const isKeener = input.companyName.toLowerCase().includes("keener");
  if (isKeener) return "KEENER_LOGISTICS";
  if (input.quoteMode === "OAT_IF_BROKERED" || input.quoteMode === "KEENER_LOGISTICS") {
    return input.quoteMode;
  }
  return input.quoteMode === "OAT_DIRECT" ? "OAT_DIRECT" : "OAT_DIRECT";
}

export function quoteModelTitle(mode: string | QuoteMode) {
  return getQuoteModelConfig(mode).title;
}

export function formatVehicleSummary(input: {
  year?: string | null;
  make?: string | null;
  model?: string | null;
  type?: string | null;
}) {
  const parts = [input.year, input.make, input.model, input.type].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vehicle not specified";
}
