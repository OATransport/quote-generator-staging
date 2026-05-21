import { CheckCircle2, CircleDashed, ShieldOff } from "lucide-react";
import { getReleaseReadinessItems, type ReadinessStatus } from "@/lib/release-readiness";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusStyles: Record<ReadinessStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ready: { label: "Ready", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  needs_review: { label: "Needs review", className: "bg-amber-100 text-amber-900", icon: CircleDashed },
  disabled: { label: "Disabled by design", className: "bg-slate-200 text-slate-700", icon: ShieldOff },
};

export function ReleaseReadinessCard() {
  const items = getReleaseReadinessItems();

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Release readiness</CardTitle>
        <CardDescription>Feature lock checklist before GHL write-back work. Internal only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const style = statusStyles[item.status];
          const Icon = style.icon;
          return (
            <div key={item.id} className="rounded-xl border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", style.className)}>
                  <Icon className="h-3.5 w-3.5" />
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
