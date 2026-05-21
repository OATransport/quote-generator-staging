import { cn } from "@/lib/utils";

export function CompanyBadge({ name, className }: { name: string; className?: string }) {
  const isKeener = name.toLowerCase().includes("keener");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        isKeener ? "bg-slate-800 text-white" : "bg-sky-700 text-white",
        className,
      )}
    >
      {isKeener ? "Keener" : "OAT"}
    </span>
  );
}

export function QuoteStatusBadge({ status, className }: { status: string; className?: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    IMPORTED_FROM_GHL: "bg-violet-100 text-violet-800",
    READY_TO_SEND: "bg-blue-100 text-blue-800",
    PDF_GENERATED: "bg-indigo-100 text-indigo-800",
    SYNCED_TO_GHL: "bg-indigo-100 text-indigo-800",
    SENT: "bg-indigo-100 text-indigo-800",
    VIEWED: "bg-cyan-100 text-cyan-800",
    QUESTION: "bg-amber-100 text-amber-900",
    ACCEPTED: "bg-emerald-100 text-emerald-800",
    DECLINED: "bg-red-100 text-red-800",
    CANCELLED: "bg-slate-100 text-slate-600",
    EXPIRED: "bg-slate-100 text-slate-600",
    CONVERTED: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function ArchivedBadge({ archivedAt, className }: { archivedAt: Date; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-800", className)}>
      Archived · {archivedAt.toLocaleDateString()}
    </span>
  );
}

export function FollowUpBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900", className)}>
      Needs follow-up
    </span>
  );
}
