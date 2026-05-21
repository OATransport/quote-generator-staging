import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SyncSafetyStatus = {
  syncBackEnabled: boolean;
  autoSyncBackEnabled: boolean;
};

export function GhlMappingPageIntro() {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">GoHighLevel integration</p>
      <h2 className="text-3xl font-bold tracking-normal">GHL field mapping</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Mappings connect GoHighLevel opportunity data with quote app fields. Intake mappings pull GHL contact and
        opportunity values into quotes during import or refresh. Quote-result mappings send quote app outcomes back to
        GHL opportunity custom fields during manual sync-back. OAT and Keener use separate GHL locations and separate
        field IDs — never mix them.
      </p>
    </div>
  );
}

export function GhlMappingSafetyPanel({ sync }: { sync: SyncSafetyStatus }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-amber-200 bg-amber-50/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            Mapping safety
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-950">
          <p>Editing mappings can break imports or sync-back. Only change field IDs when you know the matching GHL account.</p>
          <p>Field IDs must come from the same GHL location as the account card above — not from the other brand.</p>
          <p>
            Intake fallback paths are usually safe to adjust. Quote-result mappings should only change when the GHL
            destination field is wrong.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            Sync-back status
          </CardTitle>
          <CardDescription>Real GHL writes stay off until both flags are deliberately enabled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span>Manual sync writes</span>
            <SyncFlagBadge enabled={sync.syncBackEnabled} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span>Automatic sync writes</span>
            <SyncFlagBadge enabled={sync.autoSyncBackEnabled} />
          </div>
          <p className="text-muted-foreground">
            Staging should keep both disabled. Manual sync currently validates payloads and logs{" "}
            <span className="font-medium text-foreground">SKIPPED</span> instead of writing to GHL.
          </p>
          <p className="text-muted-foreground">
            Live quote links are the primary customer deliverable. A missing Quote PDF URL is acceptable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SyncFlagBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        enabled
          ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"
          : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
      }
    >
      {enabled ? "Enabled" : "Disabled (safe)"}
    </span>
  );
}

export function GhlMappingSectionIntro({
  title,
  direction,
  helperText,
}: {
  title: string;
  direction: "ghl-to-app" | "app-to-ghl";
  helperText: string;
}) {
  const directionLabel = direction === "ghl-to-app" ? "GHL → App" : "App → GHL";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">{directionLabel}</span>
      </div>
      <p className="text-sm text-muted-foreground">{helperText}</p>
    </div>
  );
}
