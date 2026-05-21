"use client";

import type { GeoCoordinate } from "@/lib/geo";
import { formatApproxRouteDistance, haversineMiles, projectUsLatLonToSvg } from "@/lib/geo";
import { buildUsGridLines, buildUsOutlineSvgPath } from "@/lib/usa-map-path";
import { cn } from "@/lib/utils";

type UsaRouteMapVisualProps = {
  pickup: GeoCoordinate;
  delivery: GeoCoordinate;
  routeSummary: string;
  pickupLabel: string;
  deliveryLabel: string;
  isKeener?: boolean;
};

export function UsaRouteMapVisual({
  pickup,
  delivery,
  routeSummary,
  pickupLabel,
  deliveryLabel,
  isKeener,
}: UsaRouteMapVisualProps) {
  const width = 800;
  const height = 460;
  const padding = 32;
  const usOutline = buildUsOutlineSvgPath(width, height, padding);
  const gridLines = buildUsGridLines(width, height, padding);
  const pickupPoint = projectUsLatLonToSvg(pickup, width, height, padding);
  const deliveryPoint = projectUsLatLonToSvg(delivery, width, height, padding);
  const midX = (pickupPoint.x + deliveryPoint.x) / 2;
  const midY = Math.min(pickupPoint.y, deliveryPoint.y) - 56;
  const routePath = `M ${pickupPoint.x} ${pickupPoint.y} Q ${midX} ${midY} ${deliveryPoint.x} ${deliveryPoint.y}`;
  const distance = formatApproxRouteDistance(haversineMiles(pickup, delivery));
  const accent = isKeener ? "#334155" : "#0284c7";
  const pickupColor = "#059669";
  const deliveryColor = "#4f46e5";

  return (
    <div className="overflow-hidden rounded-3xl border bg-white shadow-lg ring-1 ring-black/5">
      <div className={cn("px-6 py-4 text-white sm:px-8", isKeener ? "bg-slate-900" : "bg-sky-900")}>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-white/75">U.S. Transport Route</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{routeSummary}</p>
        {distance ? (
          <p className="mt-2 text-sm text-white/85">
            Approx. route distance: {distance}
            <span className="mt-1 block text-xs text-white/60">Final dispatch route may vary.</span>
          </p>
        ) : null}
      </div>

      <div className="relative bg-gradient-to-b from-sky-50/90 via-slate-50/50 to-white px-3 py-5 sm:px-6">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto w-full max-w-4xl"
          role="img"
          aria-label={`Route map from ${pickupLabel} to ${deliveryLabel}`}
        >
          <defs>
            <linearGradient id="usaRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={pickupColor} />
              <stop offset="50%" stopColor={accent} />
              <stop offset="100%" stopColor={deliveryColor} />
            </linearGradient>
            <clipPath id="usMapClip">
              <path d={usOutline} />
            </clipPath>
          </defs>

          {gridLines.map((line, index) => (
            <path
              key={`grid-${index}`}
              d={line}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeOpacity="0.45"
              clipPath="url(#usMapClip)"
            />
          ))}

          <path d={usOutline} fill="#e8eef4" stroke="#94a3b8" strokeWidth="2.5" strokeLinejoin="round" />
          <path
            d={routePath}
            fill="none"
            stroke="url(#usaRouteGradient)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray="12 8"
            className="route-dash-animate"
          />
          <RoutePin point={pickupPoint} color={pickupColor} label="P" />
          <RoutePin point={deliveryPoint} color={deliveryColor} label="D" />
        </svg>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pickup</p>
            <p className="mt-1 font-medium">{pickupLabel}</p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Delivery</p>
            <p className="mt-1 font-medium">{deliveryLabel}</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes routeDash {
          to { stroke-dashoffset: -40; }
        }
        .route-dash-animate {
          animation: routeDash 2.6s linear infinite;
        }
      `}</style>
    </div>
  );
}

function RoutePin({ point, color, label }: { point: { x: number; y: number }; color: string; label: string }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r="20" fill={color} opacity="0.14" />
      <circle cx={point.x} cy={point.y} r="11" fill={color} stroke="white" strokeWidth="2.5" />
      <text x={point.x} y={point.y + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="700">
        {label}
      </text>
    </g>
  );
}
