"use client";

import type { GeoCoordinate } from "@/lib/geo";
import { formatApproxRouteDistance, haversineMiles, projectUsLatLonToSvg } from "@/lib/geo";
import { cn } from "@/lib/utils";

/** Simplified continental US silhouette for SVG backdrop */
const US_SILHOUETTE_PATH =
  "M 42 168 L 58 152 L 72 138 L 88 128 L 108 118 L 128 108 L 150 98 L 176 88 L 204 78 L 232 72 L 260 68 L 290 62 L 320 58 L 350 54 L 380 50 L 410 48 L 440 46 L 470 44 L 500 42 L 530 40 L 560 38 L 590 36 L 620 34 L 650 32 L 680 30 L 710 28 L 740 26 L 770 24 L 790 22 L 792 38 L 788 54 L 784 70 L 780 86 L 776 102 L 772 118 L 768 134 L 764 150 L 760 166 L 756 182 L 748 198 L 736 214 L 720 228 L 700 238 L 676 244 L 650 248 L 622 250 L 592 252 L 560 254 L 528 256 L 496 258 L 464 260 L 432 262 L 400 264 L 368 266 L 336 268 L 304 270 L 272 272 L 240 274 L 208 276 L 176 278 L 144 280 L 112 282 L 80 284 L 48 286 L 42 270 L 40 252 L 38 234 L 36 216 L 34 198 L 32 180 L 34 168 Z";

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
  const height = 420;
  const pickupPoint = projectUsLatLonToSvg(pickup, width, height, 36);
  const deliveryPoint = projectUsLatLonToSvg(delivery, width, height, 36);
  const midX = (pickupPoint.x + deliveryPoint.x) / 2;
  const midY = Math.min(pickupPoint.y, deliveryPoint.y) - 48;
  const routePath = `M ${pickupPoint.x} ${pickupPoint.y} Q ${midX} ${midY} ${deliveryPoint.x} ${deliveryPoint.y}`;
  const distance = formatApproxRouteDistance(haversineMiles(pickup, delivery));
  const accent = isKeener ? "#334155" : "#0284c7";
  const pickupColor = "#059669";
  const deliveryColor = "#4f46e5";

  return (
    <div className="overflow-hidden rounded-3xl border bg-white shadow-lg ring-1 ring-black/5">
      <div className={cn("px-6 py-4 text-white sm:px-8", isKeener ? "bg-slate-900" : "bg-sky-900")}>
        <p className="text-sm font-medium text-white/80">U.S. transport route</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{routeSummary}</p>
        {distance ? (
          <p className="mt-2 text-sm text-white/80">
            Approx. route distance: {distance}
            <span className="block text-xs text-white/60">Final dispatch route may vary.</span>
          </p>
        ) : null}
      </div>

      <div className="relative bg-gradient-to-b from-sky-50/80 to-white px-3 py-4 sm:px-6">
        <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto w-full max-w-4xl" role="img" aria-label={`Route map from ${pickupLabel} to ${deliveryLabel}`}>
          <defs>
            <linearGradient id="usaRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={pickupColor} />
              <stop offset="50%" stopColor={accent} />
              <stop offset="100%" stopColor={deliveryColor} />
            </linearGradient>
          </defs>
          <path d={US_SILHOUETTE_PATH} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" opacity="0.95" />
          <path
            d={routePath}
            fill="none"
            stroke="url(#usaRouteGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="10 8"
            className="route-dash-animate"
          />
          <RoutePin point={pickupPoint} color={pickupColor} label="P" />
          <RoutePin point={deliveryPoint} color={deliveryColor} label="D" />
        </svg>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
          to { stroke-dashoffset: -36; }
        }
        .route-dash-animate {
          animation: routeDash 2.4s linear infinite;
        }
      `}</style>
    </div>
  );
}

function RoutePin({ point, color, label }: { point: { x: number; y: number }; color: string; label: string }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r="18" fill={color} opacity="0.15" />
      <circle cx={point.x} cy={point.y} r="10" fill={color} />
      <text x={point.x} y={point.y + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="700">
        {label}
      </text>
    </g>
  );
}
