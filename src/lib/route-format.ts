function normalize(value?: string | null) {
  return value?.trim() ?? "";
}

function buildCityStateZip(city: string, state: string, zip: string) {
  const cityState = [city, state].filter(Boolean).join(", ");
  if (cityState && zip) return `${cityState} ${zip}`;
  return cityState || zip;
}

function containsSegment(haystack: string, segment: string) {
  if (!segment || segment.length < 2) return false;
  return haystack.toLowerCase().includes(segment.toLowerCase());
}

export type FormattedRouteLocation = {
  lines: string[];
  singleLine: string;
};

export function formatRouteLocation(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
): FormattedRouteLocation {
  const street = normalize(address);
  const cityValue = normalize(city);
  const stateValue = normalize(state);
  const zipValue = normalize(zip);
  const cityStateZip = buildCityStateZip(cityValue, stateValue, zipValue);

  if (!street && !cityStateZip) {
    return { lines: ["Not specified"], singleLine: "Not specified" };
  }

  if (!cityStateZip) {
    return { lines: [street], singleLine: street };
  }

  if (!street) {
    return { lines: [cityStateZip], singleLine: cityStateZip };
  }

  const cityInStreet = cityValue.length > 0 && containsSegment(street, cityValue);
  const stateInStreet = stateValue.length > 0 && containsSegment(street, stateValue);
  const zipInStreet = zipValue.length > 0 && containsSegment(street, zipValue);
  const cityStateZipInStreet =
    containsSegment(street, cityStateZip) ||
    (cityInStreet && stateInStreet) ||
    (cityInStreet && zipInStreet) ||
    (stateInStreet && zipInStreet);

  if (cityStateZipInStreet) {
    return { lines: [street], singleLine: street };
  }

  return { lines: [street, cityStateZip], singleLine: `${street}, ${cityStateZip}` };
}

export function formatRouteSummaryShort(
  pickupCity?: string | null,
  pickupState?: string | null,
  deliveryCity?: string | null,
  deliveryState?: string | null,
) {
  const pickup = [normalize(pickupCity), normalize(pickupState)].filter(Boolean).join(", ") || "Pickup TBD";
  const delivery = [normalize(deliveryCity), normalize(deliveryState)].filter(Boolean).join(", ") || "Delivery TBD";
  return `${pickup} → ${delivery}`;
}
