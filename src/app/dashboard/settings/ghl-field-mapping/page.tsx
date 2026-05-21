import Link from "next/link";
import { AlertTriangle, Plus, Save } from "lucide-react";
import { createMissingQuoteResultFieldsAction, saveGhlFieldMappingsAction } from "@/app/actions";
import { GhlAccountCards } from "@/components/ghl-mapping/ghl-account-cards";
import { GhlFieldIndicatorBadges } from "@/components/ghl-mapping/ghl-field-indicator-badges";
import {
  GhlMappingPageIntro,
  GhlMappingSafetyPanel,
  GhlMappingSectionIntro,
} from "@/components/ghl-mapping/ghl-mapping-guidance";
import { GhlMappingOverview } from "@/components/ghl-mapping/ghl-mapping-overview";
import { mappedFieldIds, mappingsByLocationFromRecords } from "@/components/ghl-mapping/ghl-mapping-summary-table";
import { GhlUnmappedFieldsPanel } from "@/components/ghl-mapping/ghl-unmapped-fields";
import { isMappingEffectivelyMapped } from "@/lib/ghl-mapping-display";
import type { GhlFieldMapping } from "@prisma/client";
import { labelForGhlImportAccountKey, accountKeyForGhlLocationId } from "@/lib/ghl-accounts";
import {
  leadImportFieldMeta,
  quoteResultFieldMeta,
  type MappingFieldMeta,
} from "@/lib/ghl-field-mapping-meta";
import {
  getActiveGhlLocationIdOrNull,
  getGhlFieldMappingsForLocation,
  KEENER_GHL_LOCATION_ID,
  OAT_GHL_LOCATION_ID,
} from "@/lib/ghl-field-mappings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGhlCustomFields, isGhlAutoSyncBackEnabled, isGhlSyncBackEnabled, type GhlCustomFieldOption } from "@/server/ghl";

export const dynamic = "force-dynamic";

export default async function GhlFieldMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; mapped?: string; skipped?: string; failed?: string }>;
}) {
  const params = await searchParams;
  const activeLocationId = getActiveGhlLocationIdOrNull();
  const activeAccountKey = activeLocationId ? accountKeyForGhlLocationId(activeLocationId) : undefined;
  const activeAccountLabel = activeAccountKey ? labelForGhlImportAccountKey(activeAccountKey) : "Active GHL location";

  const [oatMappings, keenerMappings] = await Promise.all([
    getGhlFieldMappingsForLocation(OAT_GHL_LOCATION_ID),
    getGhlFieldMappingsForLocation(KEENER_GHL_LOCATION_ID),
  ]);
  const allMappings = [...oatMappings, ...keenerMappings];
  const mappingsByLocation = mappingsByLocationFromRecords(allMappings);
  const activeMappings = activeLocationId
    ? mappingsByLocation.get(activeLocationId) ?? new Map()
    : new Map<string, { ghlCustomFieldId: string | null; fallbackPath: string | null }>();

  let customFields: GhlCustomFieldOption[] = [];
  let fetchError: string | undefined;

  try {
    customFields = activeLocationId ? await getGhlCustomFields(activeLocationId) : [];
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Unable to fetch GoHighLevel custom fields.";
  }

  const missingCriticalFields = [...leadImportFieldMeta, ...quoteResultFieldMeta].filter((field) => {
    if (!field.indicators.includes("critical") || !activeLocationId) return false;
    const mapping = activeMappings.get(field.key);
    return !isMappingEffectivelyMapped(field, mapping as GhlFieldMapping | undefined, activeLocationId);
  });

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <GhlMappingPageIntro />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/settings/ghl">Legacy mapping table</Link>
          </Button>
          <form action={createMissingQuoteResultFieldsAction}>
            <Button type="submit" variant="outline">
              <Plus className="h-4 w-4" /> Create missing quote result fields
            </Button>
          </form>
        </div>
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Create missing quote result fields</strong> creates real GHL custom fields. Do not run this on staging
        unless you intentionally need new GHL fields for the active account.
      </p>

      <GhlMappingSafetyPanel
        sync={{
          syncBackEnabled: isGhlSyncBackEnabled(),
          autoSyncBackEnabled: isGhlAutoSyncBackEnabled(),
        }}
      />

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">GHL accounts</h3>
        <GhlAccountCards activeLocationId={activeLocationId} />
      </div>

      {fetchError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {fetchError}
        </div>
      )}

      {(params.created || params.mapped || params.skipped || params.failed) && (
        <div className="rounded-md border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">
          Created {params.created ?? 0} quote result fields, mapped {params.mapped ?? 0} existing quote result fields,
          skipped {params.skipped ?? 0} protected mappings, failed {params.failed ?? 0}.
        </div>
      )}

      {missingCriticalFields.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Missing critical mappings for {activeAccountLabel}
          </div>
          <p className="mt-2">{missingCriticalFields.map((field) => field.label).join(", ")}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mapping overview</CardTitle>
          <CardDescription>
            Filter by what matters. Full editable controls below apply only to the active environment location.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GhlMappingOverview mappingsByLocation={mappingsByLocation} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit mappings for {activeAccountLabel}</CardTitle>
          <CardDescription>
            {activeLocationId ? (
              <>
                Saving updates mappings for location{" "}
                <span className="font-mono text-xs">{activeLocationId}</span> only. To edit the other account, change
                the deployment <span className="font-mono text-xs">GHL_LOCATION_ID</span> to that account&apos;s location
                ID.
              </>
            ) : (
              "Configure GHL_LOCATION_ID to edit mappings."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveGhlFieldMappingsAction} className="space-y-8">
            <section className="space-y-4">
              <GhlMappingSectionIntro
                title="Intake mappings"
                direction="ghl-to-app"
                helperText="These fields are read from GHL when importing or refreshing a quote."
              />
              <MappingEditorSection
                fields={leadImportFieldMeta}
                customFields={customFields}
                mappingByKey={activeMappings}
              />
            </section>

            <section className="space-y-4">
              <GhlMappingSectionIntro
                title="Quote-result mappings"
                direction="app-to-ghl"
                helperText="These fields are written back to GHL only during manual sync while sync writes are enabled."
              />
              <MappingEditorSection
                fields={quoteResultFieldMeta}
                customFields={customFields}
                mappingByKey={activeMappings}
              />
            </section>

            <div className="sticky bottom-0 flex justify-end border-t bg-background/95 p-4 backdrop-blur">
              <Button type="submit">
                <Save className="h-4 w-4" /> Save mappings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {customFields.length > 0 && activeLocationId && (
        <GhlUnmappedFieldsPanel
          customFields={customFields}
          mappedIds={mappedFieldIds(oatMappings.concat(keenerMappings).filter((m) => m.ghlLocationId === activeLocationId))}
          accountLabel={activeAccountLabel}
        />
      )}
    </div>
  );
}

function MappingEditorSection({
  fields,
  customFields,
  mappingByKey,
}: {
  fields: MappingFieldMeta[];
  customFields: GhlCustomFieldOption[];
  mappingByKey: Map<string, { ghlCustomFieldId: string | null; fallbackPath: string | null }>;
}) {
  return (
    <div className="grid gap-4">
      {fields.map((field) => {
        const mapping = mappingByKey.get(field.key);
        return (
          <div key={field.key} className="grid gap-3 rounded-md border p-4 lg:grid-cols-[minmax(220px,260px)_1fr_260px]">
            <div className="space-y-2">
              <Label htmlFor={`field_${field.key}`}>{field.label}</Label>
              <p className="font-mono text-xs text-muted-foreground">{field.key}</p>
              <GhlFieldIndicatorBadges indicators={field.indicators} />
              {field.notes && <p className="text-xs text-muted-foreground">{field.notes}</p>}
              <p className="text-[11px] text-muted-foreground">
                Safe to edit:{" "}
                {field.safeToEdit === "mapping-and-fallback"
                  ? "mapping + fallback path"
                  : field.safeToEdit === "mapping-only"
                    ? "mapping only"
                    : "avoid unless needed"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`field_${field.key}`}>GHL custom field</Label>
              <select
                id={`field_${field.key}`}
                name={`field_${field.key}`}
                defaultValue={mapping?.ghlCustomFieldId ?? ""}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Unmapped</option>
                {customFields.map((customField) => (
                  <option key={customField.id} value={customField.id}>
                    {customField.name}
                    {customField.fieldKey ? ` (${customField.fieldKey})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`fallback_${field.key}`}>Fallback path</Label>
              <Input
                id={`fallback_${field.key}`}
                name={`fallback_${field.key}`}
                defaultValue={mapping?.fallbackPath ?? ""}
                placeholder={field.direction === "ghl-to-app" ? "e.g. contact.email" : "Not used on sync-back"}
                disabled={field.direction === "app-to-ghl"}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
