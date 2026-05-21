import { GHL_IMPORT_ACCOUNTS } from "@/lib/ghl-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GhlAccountCards({ activeLocationId }: { activeLocationId?: string | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {GHL_IMPORT_ACCOUNTS.map((account) => {
        const isActive = activeLocationId === account.ghlLocationId;
        return (
          <Card key={account.key} className={isActive ? "border-primary/40 ring-1 ring-primary/20" : undefined}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{account.label}</CardTitle>
                {isActive && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Active env
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location ID</p>
                <p className="font-mono text-xs">{account.ghlLocationId}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline</p>
                <p>{account.pipelineName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Import stage</p>
                <p>{account.stageName}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Use only this account&apos;s GHL custom field IDs here. Never mix OAT IDs with Keener IDs.
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
