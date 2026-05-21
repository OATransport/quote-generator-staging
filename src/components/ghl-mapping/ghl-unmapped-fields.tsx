import type { GhlCustomFieldOption } from "@/server/ghl";

export function GhlUnmappedFieldsPanel({
  customFields,
  mappedIds,
  accountLabel,
}: {
  customFields: GhlCustomFieldOption[];
  mappedIds: Set<string>;
  accountLabel: string;
}) {
  const unmapped = customFields.filter((field) => !mappedIds.has(field.id));
  if (!customFields.length) return null;

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <h4 className="text-sm font-semibold">GHL fields not currently used ({accountLabel})</h4>
      <p className="mt-2 text-sm text-muted-foreground">
        These custom fields exist in GHL but are not mapped to any app field. That is normal — not every GHL field
        needs a mapping. Only map a field when the app has a destination for that data.
      </p>
      {unmapped.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {unmapped.map((field) => (
            <li key={field.id} className="rounded-md border bg-background px-3 py-2 text-sm">
              <p className="font-medium">{field.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{field.id}</p>
              {field.fieldKey && <p className="text-xs text-muted-foreground">{field.fieldKey}</p>}
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                Not currently used
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Every fetched GHL custom field is mapped for this account.</p>
      )}
    </div>
  );
}
