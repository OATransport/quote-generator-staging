/** Continental US bounds for simple SVG projection */
export const US_MAP_BOUNDS = {
  minLat: 24.5,
  maxLat: 49.5,
  minLon: -125,
  maxLon: -66.5,
};

export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

export function projectUsLatLonToSvg(
  coord: GeoCoordinate,
  width: number,
  height: number,
  padding = 24,
) {
  const { minLat, maxLat, minLon, maxLon } = US_MAP_BOUNDS;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const x = padding + ((coord.longitude - minLon) / (maxLon - minLon)) * innerWidth;
  const y = padding + innerHeight - ((coord.latitude - minLat) / (maxLat - minLat)) * innerHeight;
  return { x, y };
}

export function haversineMiles(a: GeoCoordinate, b: GeoCoordinate) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.asin(Math.sqrt(h));
}

export function formatApproxRouteDistance(miles: number) {
  if (!Number.isFinite(miles) || miles <= 0) return null;
  return `${Math.round(miles).toLocaleString()} mi`;
}
