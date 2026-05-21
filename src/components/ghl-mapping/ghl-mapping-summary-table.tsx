import type { GhlFieldMapping } from "@prisma/client";
import { GHL_IMPORT_ACCOUNTS } from "@/lib/ghl-accounts";
import {
  allMappingFieldMeta,
  directionLabel,
  requiredLabel,
  type MappingFieldMeta,
} from "@/lib/ghl-field-mapping-meta";
import { GhlFieldIndicatorBadges } from "@/components/ghl-mapping/ghl-field-indicator-badges";

type MappingRow = {
  accountLabel: string;
  locationId: string;
  mapping?: GhlFieldMapping;
  field: MappingFieldMeta;
};

function buildRows(
  fields: MappingFieldMeta[],
  mappingsByLocation: Map<string, Map<string, GhlFieldMapping>>,
): MappingRow[] {
  const rows: MappingRow[] = [];
  for (const account of GHL_IMPORT_ACCOUNTS) {
    const accountMappings = mappingsByLocation.get(account.ghlLocationId) ?? new Map();
    for (const field of fields) {
      rows.push({
        accountLabel: account.label,
        locationId: account.ghlLocationId,
        mapping: accountMappings.get(field.key),
        field,
      });
    }
  }
  return rows;
}

export function GhlMappingSummaryTable({
  title,
  fields,
  mappingsByLocation,
}: {
  title: string;
  fields: MappingFieldMeta[];
  mappingsByLocation: Map<string, Map<string, GhlFieldMapping>>;
}) {
  const rows = buildRows(fields, mappingsByLocation);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Account</th>
              <th className="p-3">App field</th>
              <th className="p-3">Direction</th>
              <th className="p-3">GHL field label</th>
              <th className="p-3">GHL field ID</th>
              <th className="p-3">Status</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mapped = Boolean(row.mapping?.ghlCustomFieldId);
              return (
                <tr key={`${row.locationId}-${row.field.key}`} className="border-t align-top">
                  <td className="p-3">
                    <p className="font-medium">{row.accountLabel}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{row.locationId}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{row.field.label}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{row.field.key}</p>
                    <GhlFieldIndicatorBadges indicators={row.field.indicators} className="mt-2" />
                  </td>
                  <td className="p-3 whitespace-nowrap">{directionLabel(row.field.direction)}</td>
                  <td className="p-3">{row.mapping?.ghlCustomFieldName ?? (mapped ? "—" : "Unmapped")}</td>
                  <td className="p-3 font-mono text-xs">{row.mapping?.ghlCustomFieldId ?? "—"}</td>
                  <td className="p-3">
                    <span
                      className={
                        mapped
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                      }
                    >
                      {mapped ? requiredLabel(row.field) : "Not mapped"}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{row.field.notes ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function mappingsByLocationFromRecords(mappings: GhlFieldMapping[]) {
  const result = new Map<string, Map<string, GhlFieldMapping>>();
  for (const mapping of mappings) {
    const locationMap = result.get(mapping.ghlLocationId) ?? new Map();
    locationMap.set(mapping.appFieldKey, mapping);
    result.set(mapping.ghlLocationId, locationMap);
  }
  return result;
}

export function mappedFieldIds(mappings: GhlFieldMapping[]) {
  return new Set(mappings.map((mapping) => mapping.ghlCustomFieldId).filter(Boolean) as string[]);
}

export { allMappingFieldMeta };
