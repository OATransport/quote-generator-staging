import { AlertTriangle, Plus, Save } from "lucide-react";
import { createMissingQuoteResultFieldsAction, saveGhlFieldMappingsAction } from "@/app/actions";
import { allMappingFields, leadImportFields, quoteResultFields } from "@/lib/ghl-field-mapping-config";
import { getGhlFieldMappingsForActiveLocation } from "@/lib/ghl-field-mappings";
import { prisma } from "@/lib/prisma";
import { getGhlCustomFields, type GhlCustomFieldOption } from "@/server/ghl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function GhlFieldMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; mapped?: string; skipped?: string; failed?: string }>;
}) {
  const params = await searchParams;
  const mappings = await getGhlFieldMappingsForActiveLocation();
  const mappingByKey = new Map(mappings.map((mapping) => [mapping.appFieldKey, mapping]));
  let customFields: GhlCustomFieldOption[] = [];
  let fetchError: string | undefined;

  try {
    customFields = await getGhlCustomFields();
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Unable to fetch GoHighLevel custom fields.";
  }

  const missingCriticalFields = allMappingFields.filter((field) => field.critical && !mappingByKey.get(field.key)?.ghlCustomFieldId);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Use existing GoHighLevel fields</p>
          <h2 className="text-3xl font-bold tracking-normal">GHL field mapping</h2>
        </div>
        <form action={createMissingQuoteResultFieldsAction}>
          <Button type="submit" variant="outline">
            <Plus className="h-4 w-4" /> Create Missing Quote Result Fields
          </Button>
        </form>
      </div>

      {fetchError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {fetchError}
        </div>
      )}

      {(params.created || params.mapped || params.skipped || params.failed) && (
        <div className="rounded-md border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">
          Created {params.created ?? 0} quote result fields, mapped {params.mapped ?? 0} existing quote result fields, skipped{" "}
          {params.skipped ?? 0} protected mappings, failed {params.failed ?? 0}.
        </div>
      )}

      {missingCriticalFields.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Missing critical mappings
          </div>
          <p className="mt-2">
            {missingCriticalFields.map((field) => field.label).join(", ")}
          </p>
        </div>
      )}

      <form action={saveGhlFieldMappingsAction} className="space-y-6">
        <MappingSection
          title="Lead import fields"
          description="Map the app to customer, pickup, delivery, and vehicle fields that already exist in GHL."
          fields={leadImportFields}
          customFields={customFields}
          mappingByKey={mappingByKey}
        />
        <MappingSection
          title="Quote result fields"
          description="These are the only fields this app can create. Existing mappings are protected unless you change them manually."
          fields={quoteResultFields}
          customFields={customFields}
          mappingByKey={mappingByKey}
        />
        <div className="sticky bottom-0 flex justify-end border-t bg-background/95 p-4 backdrop-blur">
          <Button type="submit">
            <Save className="h-4 w-4" /> Save mappings
          </Button>
        </div>
      </form>
    </div>
  );
}

function MappingSection({
  title,
  description,
  fields,
  customFields,
  mappingByKey,
}: {
  title: string;
  description: string;
  fields: typeof allMappingFields;
  customFields: GhlCustomFieldOption[];
  mappingByKey: Map<string, { ghlCustomFieldId: string | null; fallbackPath: string | null }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {fields.map((field) => {
            const mapping = mappingByKey.get(field.key);
            return (
              <div key={field.key} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[220px_1fr_260px]">
                <div>
                  <Label htmlFor={`field_${field.key}`}>{field.label}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{field.key}</p>
                  {field.critical && <p className="mt-1 text-xs font-medium text-amber-700">Critical</p>}
                </div>
                <div className="space-y-2">
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
                    placeholder="Optional JSON path"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
