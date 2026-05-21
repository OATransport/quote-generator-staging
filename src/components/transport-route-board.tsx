"use client";

import { ArrowRight, MapPin, Navigation, Route, Truck } from "lucide-react";
import type { FormattedRouteLocation } from "@/lib/route-format";
import { cn } from "@/lib/utils";

type TransportRouteBoardProps = {
  pickup: FormattedRouteLocation;
  delivery: FormattedRouteLocation;
  routeSummary: string;
  isKeener?: boolean;
  transportType?: string | null;
  estimatedDistance?: string | null;
};

export function TransportRouteBoard({
  pickup,
  delivery,
  routeSummary,
  isKeener,
  transportType,
  estimatedDistance,
}: TransportRouteBoardProps) {
  const pickupPrimary = pickup.lines[0] ?? "Pickup";
  const pickupSecondary = pickup.lines.slice(1).join(", ");
  const deliveryPrimary = delivery.lines[0] ?? "Delivery";
  const deliverySecondary = delivery.lines.slice(1).join(", ");

  const headerFrom = isKeener ? "from-slate-950 via-slate-900 to-slate-800" : "from-sky-950 via-sky-900 to-blue-900";
  const pickupAccent = "bg-emerald-600";
  const deliveryAccent = "bg-indigo-600";
  const routeAccent = isKeener ? "text-slate-700" : "text-sky-700";

  const badges = [
    "Door-to-door",
    transportType?.trim() || null,
    estimatedDistance ? `Est. ${estimatedDistance}` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg ring-1 ring-black/[0.04]">
      <div className={cn("relative px-5 py-6 text-white sm:px-8 sm:py-7", `bg-gradient-to-br ${headerFrom}`)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Navigation className="h-4 w-4 shrink-0" />
            <span>Your transport route</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{routeSummary}</h2>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative bg-gradient-to-b from-slate-50 to-white px-4 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <RouteEndpointCard
            title="Pickup"
            primary={pickupPrimary}
            secondary={pickupSecondary}
            accentClass={pickupAccent}
          />

          <div className="hidden flex-col items-center gap-3 px-2 lg:flex">
            <div className={cn("rounded-full border border-slate-200 bg-white p-3 shadow-sm", routeAccent)}>
              <Truck className="h-5 w-5" />
            </div>
            <RouteTimelineLine className="w-32" isKeener={isKeener} />
            <ArrowRight className={cn("h-5 w-5", routeAccent)} />
          </div>

          <RouteEndpointCard
            title="Delivery"
            primary={deliveryPrimary}
            secondary={deliverySecondary}
            accentClass={deliveryAccent}
            align="end"
          />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground lg:hidden">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground">{pickupPrimary}</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground">{deliveryPrimary}</span>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <Route className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Final dispatch route may vary based on carrier assignment and road conditions.</span>
        </div>
      </div>
    </section>
  );
}

function RouteTimelineLine({ className, isKeener }: { className?: string; isKeener?: boolean }) {
  const stroke = isKeener ? "#475569" : "#0284c7";
  return (
    <svg viewBox="0 0 128 12" className={cn("h-3", className)} aria-hidden>
      <defs>
        <linearGradient id="routeBoardLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="50%" stopColor={stroke} />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <line x1="4" y1="6" x2="124" y2="6" stroke="url(#routeBoardLine)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="4" cy="6" r="4" fill="#059669" />
      <circle cx="124" cy="6" r="4" fill="#4f46e5" />
    </svg>
  );
}

function RouteEndpointCard({
  title,
  primary,
  secondary,
  accentClass,
  align,
}: {
  title: string;
  primary: string;
  secondary?: string;
  accentClass: string;
  align?: "end";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm",
        align === "end" && "lg:text-right",
      )}
    >
      <div className={cn("mb-4 flex items-center gap-3", align === "end" && "lg:justify-end")}>
        <div className={cn("rounded-xl p-2.5 text-white shadow-sm", accentClass)}>
          <MapPin className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      </div>
      <p className="text-lg font-semibold leading-snug text-foreground sm:text-xl">{primary}</p>
      {secondary ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{secondary}</p> : null}
    </div>
  );
}
