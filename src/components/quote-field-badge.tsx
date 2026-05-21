import { cn } from "@/lib/utils";

const variants = {
  "customer-visible": "border-sky-200 bg-sky-50 text-sky-800",
  "carrier-facing": "border-indigo-200 bg-indigo-50 text-indigo-900",
  "internal-only": "border-amber-200 bg-amber-50 text-amber-900",
  "synced-from-ghl": "border-violet-200 bg-violet-50 text-violet-800",
  "synced-to-ghl": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "optional-pdf": "border-slate-200 bg-slate-50 text-slate-700",
  "live-link-primary": "border-primary/30 bg-primary/10 text-primary",
} as const;

const labels: Record<keyof typeof variants, string> = {
  "customer-visible": "Customer-facing",
  "carrier-facing": "Carrier-facing",
  "internal-only": "Internal profit view",
  "synced-from-ghl": "Synced from GHL",
  "synced-to-ghl": "Synced to GHL",
  "optional-pdf": "Optional PDF",
  "live-link-primary": "Live-link primary",
};

export function QuoteFieldBadge({
  variant,
  className,
}: {
  variant: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        variants[variant],
        className,
      )}
    >
      {labels[variant]}
    </span>
  );
}
