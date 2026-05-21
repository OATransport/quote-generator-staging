import type { GeoCoordinate } from "@/lib/geo";
import { projectUsLatLonToSvg } from "@/lib/geo";

/**
 * Continental US border landmarks (counter-clockwise, rough census-style outline).
 * Produces a recognizable silhouette when projected — not cartographic precision.
 */
const US_BORDER_LANDMARKS: GeoCoordinate[] = [
  { latitude: 48.99, longitude: -124.77 },
  { latitude: 48.38, longitude: -123.0 },
  { latitude: 46.24, longitude: -124.05 },
  { latitude: 42.0, longitude: -124.56 },
  { latitude: 41.99, longitude: -120.0 },
  { latitude: 39.0, longitude: -120.0 },
  { latitude: 36.99, longitude: -121.5 },
  { latitude: 34.5, longitude: -120.5 },
  { latitude: 32.53, longitude: -117.12 },
  { latitude: 31.33, longitude: -111.07 },
  { latitude: 31.33, longitude: -108.2 },
  { latitude: 29.75, longitude: -103.0 },
  { latitude: 29.35, longitude: -99.0 },
  { latitude: 26.0, longitude: -97.15 },
  { latitude: 25.84, longitude: -97.4 },
  { latitude: 26.07, longitude: -80.03 },
  { latitude: 27.5, longitude: -80.0 },
  { latitude: 30.4, longitude: -81.45 },
  { latitude: 31.0, longitude: -81.0 },
  { latitude: 32.0, longitude: -80.85 },
  { latitude: 33.8, longitude: -78.5 },
  { latitude: 36.55, longitude: -75.9 },
  { latitude: 39.0, longitude: -75.5 },
  { latitude: 40.5, longitude: -74.0 },
  { latitude: 41.2, longitude: -71.8 },
  { latitude: 42.05, longitude: -70.0 },
  { latitude: 43.08, longitude: -70.5 },
  { latitude: 44.8, longitude: -67.0 },
  { latitude: 47.46, longitude: -69.22 },
  { latitude: 47.5, longitude: -88.0 },
  { latitude: 48.0, longitude: -89.5 },
  { latitude: 48.99, longitude: -95.15 },
  { latitude: 49.0, longitude: -104.05 },
  { latitude: 49.0, longitude: -116.05 },
  { latitude: 48.99, longitude: -124.77 },
];

export function buildUsOutlineSvgPath(width: number, height: number, padding = 28) {
  const points = US_BORDER_LANDMARKS.map((coord) => projectUsLatLonToSvg(coord, width, height, padding));
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") + " Z";
}

export function buildUsGridLines(width: number, height: number, padding = 28) {
  const lines: string[] = [];
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  for (let i = 1; i <= 4; i++) {
    const y = padding + (innerHeight / 5) * i;
    lines.push(`M ${padding} ${y} L ${width - padding} ${y}`);
  }
  for (let i = 1; i <= 6; i++) {
    const x = padding + (innerWidth / 7) * i;
    lines.push(`M ${x} ${padding} L ${x} ${height - padding}`);
  }
  return lines;
}
