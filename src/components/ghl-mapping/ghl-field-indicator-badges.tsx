import { cn } from "@/lib/utils";
import type { GhlFieldIndicator } from "@/lib/ghl-field-mapping-meta";

const styles: Record<GhlFieldIndicator, string> = {
  critical: "border-amber-300 bg-amber-50 text-amber-900",
  optional: "border-slate-200 bg-slate-50 text-slate-700",
  "live-link-primary": "border-primary/30 bg-primary/10 text-primary",
  "pdf-optional": "border-slate-200 bg-slate-100 text-slate-600",
  "customer-facing": "border-sky-200 bg-sky-50 text-sky-800",
  "internal-only": "border-violet-200 bg-violet-50 text-violet-800",
  "read-from-ghl": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "written-to-ghl": "border-orange-200 bg-orange-50 text-orange-900",
};

const labels: Record<GhlFieldIndicator, string> = {
  critical: "Critical",
  optional: "Optional",
  "live-link-primary": "Live-link primary",
  "pdf-optional": "PDF optional",
  "customer-facing": "Customer-facing",
  "internal-only": "Internal-only",
  "read-from-ghl": "Read from GHL",
  "written-to-ghl": "Written to GHL",
};

export function GhlFieldIndicatorBadges({
  indicators,
  className,
}: {
  indicators: GhlFieldIndicator[];
  className?: string;
}) {
  if (!indicators.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {indicators.map((indicator) => (
        <span
          key={indicator}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            styles[indicator],
          )}
        >
          {labels[indicator]}
        </span>
      ))}
    </div>
  );
}
