import { ArrowRight, MapPin, Navigation, Truck } from "lucide-react";
import type { FormattedRouteLocation } from "@/lib/route-format";
import { cn } from "@/lib/utils";

export function PublicQuoteRouteVisual({
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
  const accent = isKeener ? "from-slate-800 to-slate-950" : "from-sky-700 to-sky-900";

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 ring-black/5">
      <div className={cn("bg-gradient-to-r px-5 py-4 text-white", accent)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Navigation className="h-4 w-4" />
          <span>Transport route</span>
        </div>
        <p className="mt-1 text-lg font-semibold tracking-tight">{routeSummary}</p>
        <p className="mt-1 text-xs text-white/75">Door-to-door vehicle transport route summary</p>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr]">
        <RouteEndpoint title="Pickup" lines={pickup.lines} tone="pickup" />
        <div className="hidden items-center justify-center px-4 md:flex">
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
            <div className="rounded-full border bg-muted p-3 text-muted-foreground">
              <Truck className="h-5 w-5" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
          </div>
        </div>
        <RouteEndpoint title="Delivery" lines={delivery.lines} tone="delivery" align="end" />
      </div>

      <div className="border-t bg-muted/20 px-5 py-3 text-center text-xs text-muted-foreground md:hidden">
        <ArrowRight className="mx-auto mb-1 h-4 w-4" />
        Vehicle transport route
      </div>
    </div>
  );
}

function RouteEndpoint({
  title,
  lines,
  tone,
  align,
}: {
  title: string;
  lines: string[];
  tone: "pickup" | "delivery";
  align?: "end";
}) {
  return (
    <div className={cn("border-b p-5 md:border-b-0 md:border-r last:md:border-r-0", align === "end" && "md:text-right")}>
      <div className={cn("mb-3 flex items-center gap-2", align === "end" && "md:justify-end")}>
        <div
          className={cn(
            "rounded-lg p-2 text-white",
            tone === "pickup" ? "bg-emerald-600" : "bg-indigo-600",
          )}
        >
          <MapPin className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-1">
        {lines.map((line) => (
          <p key={line} className="text-sm font-medium leading-6 text-foreground">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
