import { ArrowRight, MapPin, Navigation, Truck } from "lucide-react";
import type { FormattedRouteLocation } from "@/lib/route-format";
import { cn } from "@/lib/utils";

export function PublicQuoteRouteCardVisual({
  pickup,
  delivery,
  routeSummary,
  isKeener,
}: {
  pickup: FormattedRouteLocation;
  delivery: FormattedRouteLocation;
  routeSummary: string;
  isKeener: boolean;
}) {
  const accentFrom = isKeener ? "#0f172a" : "#0369a1";
  const accentTo = isKeener ? "#1e293b" : "#0c4a6e";
  const routeStroke = isKeener ? "#334155" : "#0284c7";
  const pickupPin = "#059669";
  const deliveryPin = "#4f46e5";

  const pickupPrimary = pickup.lines[0] ?? "Pickup";
  const pickupSecondary = pickup.lines.slice(1).join(", ");
  const deliveryPrimary = delivery.lines[0] ?? "Delivery";
  const deliverySecondary = delivery.lines.slice(1).join(", ");

  return (
    <div className="overflow-hidden rounded-3xl border bg-white shadow-lg ring-1 ring-black/5">
      <div
        className="relative px-6 py-5 text-white sm:px-8"
        style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_45%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Navigation className="h-4 w-4" />
              <span>Your transport route</span>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight">{routeSummary}</p>
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
            Door-to-door
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-8">
        <svg viewBox="0 0 800 220" className="mx-auto hidden w-full max-w-3xl md:block" aria-hidden>
          <defs>
            <linearGradient id="routeLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={pickupPin} />
              <stop offset="50%" stopColor={routeStroke} />
              <stop offset="100%" stopColor={deliveryPin} />
            </linearGradient>
          </defs>
          <path
            d="M 90 110 C 220 60, 280 160, 400 110 S 580 60, 710 110"
            fill="none"
            stroke="url(#routeLine)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="8 10"
            className="route-dash-animate"
          />
          <circle cx="90" cy="110" r="16" fill={pickupPin} opacity="0.15" />
          <circle cx="90" cy="110" r="8" fill={pickupPin} />
          <circle cx="710" cy="110" r="16" fill={deliveryPin} opacity="0.15" />
          <circle cx="710" cy="110" r="8" fill={deliveryPin} />
          <g className="route-truck-animate">
            <rect x="382" y="96" width="36" height="22" rx="6" fill={routeStroke} />
            <rect x="404" y="100" width="14" height="14" rx="3" fill="white" opacity="0.85" />
            <circle cx="392" cy="120" r="5" fill="#0f172a" />
            <circle cx="408" cy="120" r="5" fill="#0f172a" />
          </g>
        </svg>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <RouteEndpointCard title="Pickup" primary={pickupPrimary} secondary={pickupSecondary} pinColor={pickupPin} />
          <div className="hidden items-center justify-center md:flex">
            <div className="flex flex-col items-center gap-2 px-2">
              <div className="rounded-full border bg-white p-3 shadow-sm">
                <Truck className="h-5 w-5 text-muted-foreground" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <RouteEndpointCard title="Delivery" primary={deliveryPrimary} secondary={deliverySecondary} pinColor={deliveryPin} align="end" />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground md:hidden">
          <MapPin className="h-3.5 w-3.5" />
          <span>{pickupPrimary}</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span>{deliveryPrimary}</span>
        </div>
      </div>

      <style>{`
        @keyframes routeDash { to { stroke-dashoffset: -36; } }
        @keyframes routeTruck { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(8px); } }
        .route-dash-animate { animation: routeDash 2.4s linear infinite; }
        .route-truck-animate { animation: routeTruck 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function RouteEndpointCard({
  title,
  primary,
  secondary,
  pinColor,
  align,
}: {
  title: string;
  primary: string;
  secondary?: string;
  pinColor: string;
  align?: "end";
}) {
  return (
    <div className={cn("rounded-2xl border bg-white p-5 shadow-sm", align === "end" && "md:text-right")}>
      <div className={cn("mb-4 flex items-center gap-3", align === "end" && "md:justify-end")}>
        <div className="rounded-xl p-2.5 text-white" style={{ backgroundColor: pinColor }}>
          <MapPin className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        </div>
      </div>
      <p className="text-lg font-semibold leading-snug text-foreground">{primary}</p>
      {secondary ? <p className="mt-1 text-sm text-muted-foreground">{secondary}</p> : null}
    </div>
  );
}
