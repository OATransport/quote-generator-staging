import { appUrl } from "@/lib/utils";

type LiveQuoteUrlSource = {
  acceptanceUrl?: string | null;
  secureAccessToken: string;
};

export function resolveLiveQuoteUrl(quote: LiveQuoteUrlSource) {
  return quote.acceptanceUrl ?? appUrl(`/accept/${quote.secureAccessToken}`);
}
