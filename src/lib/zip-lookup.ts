export type ZipLookupResult = {
  zip: string;
  city: string;
  state: string;
};

export type ZipLookupError = {
  error: string;
};

export function normalizeZip(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : null;
}

export async function lookupZip(zip: string): Promise<ZipLookupResult | ZipLookupError> {
  const normalized = normalizeZip(zip);
  if (!normalized) {
    return { error: "Enter a valid 5-digit ZIP code." };
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${normalized}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return { error: "ZIP lookup did not find a match. Enter city and state manually." };
    }

    const data = (await response.json()) as {
      places?: Array<{ "place name"?: string; "state abbreviation"?: string }>;
    };
    const place = data.places?.[0];
    const city = place?.["place name"]?.trim();
    const state = place?.["state abbreviation"]?.trim();

    if (!city || !state) {
      return { error: "ZIP lookup returned incomplete data. Enter city and state manually." };
    }

    return { zip: normalized, city, state };
  } catch {
    return { error: "ZIP lookup is temporarily unavailable. Enter city and state manually." };
  }
}
