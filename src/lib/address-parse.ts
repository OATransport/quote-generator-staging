export type ParsedAddress = {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

export function parseCombinedUsAddress(raw?: string | null): ParsedAddress {
  const text = raw?.trim();
  if (!text) return {};

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { address: parts[0] };
  }

  const zipMatch = parts[parts.length - 1].match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (zipMatch) {
    const state = zipMatch[1].toUpperCase();
    const zip = zipMatch[2];
    const city = parts.length >= 3 ? parts[parts.length - 2] : undefined;
    const address = parts.slice(0, parts.length - (city ? 2 : 1)).join(", ");
    return { address: address || undefined, city, state, zip };
  }

  const trailing = parts[parts.length - 1];
  const stateZipMatch = trailing.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i);
  if (stateZipMatch && US_STATE_CODES.has(stateZipMatch[1].toUpperCase())) {
    const state = stateZipMatch[1].toUpperCase();
    const zip = stateZipMatch[2];
    const city = parts.length >= 3 ? parts[parts.length - 2] : undefined;
    const address = parts.slice(0, parts.length - (city ? 2 : 1)).join(", ");
    return { address: address || undefined, city, state, zip };
  }

  if (parts.length >= 3) {
    return {
      address: parts.slice(0, -2).join(", "),
      city: parts[parts.length - 2],
      state: parts[parts.length - 1].length <= 2 ? parts[parts.length - 1].toUpperCase() : undefined,
    };
  }

  return { address: parts[0], city: parts[1] };
}

export function parseMakeModel(raw?: string | null): { make?: string; model?: string } {
  const text = raw?.trim();
  if (!text) return {};

  const withoutYear = text.replace(/^\d{4}\s+/, "").trim();
  const parts = withoutYear.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { make: parts[0], model: parts.slice(1).join(" ") };
  }
  return { make: withoutYear || text };
}

export function resolveKeenerCombinedLocation(raw?: string | null) {
  if (!raw?.trim()) return {};
  const parsed = parseCombinedUsAddress(raw);
  if (parsed.city || parsed.state || parsed.zip) {
    return {
      address: parsed.address ?? raw.trim(),
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
    };
  }
  return { address: raw.trim() };
}

export function resolveImportLocationFields(input: {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  if (input.city || input.state || input.zip) {
    return {
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
    };
  }
  const parsed = parseCombinedUsAddress(input.address);
  return {
    address: parsed.address ?? input.address,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
  };
}
