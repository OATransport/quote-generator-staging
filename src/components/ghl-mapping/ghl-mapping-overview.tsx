"use client";

import { useMemo, useState } from "react";
import type { GhlFieldMapping } from "@prisma/client";
import { GHL_IMPORT_ACCOUNTS } from "@/lib/ghl-accounts";
import { leadImportFieldMeta, quoteResultFieldMeta, type MappingFieldMeta } from "@/lib/ghl-field-mapping-meta";
import { knownGhlFieldRefForLocation } from "@/lib/ghl-known-field-ids";
import {
  effectiveKnownFallback,
  effectiveKnownFieldId,
  isMappingEffectivelyMapped,
  resolveMappingDisplayStatus,
} from "@/lib/ghl-mapping-display";
import { GhlFieldIndicatorBadges } from "@/components/ghl-mapping/ghl-field-indicator-badges";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "critical" | "missing" | "intake" | "results" | "oat" | "keener";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical only" },
  { key: "missing", label: "Missing mappings" },
  { key: "intake", label: "Intake: GHL → App" },
  { key: "results", label: "Quote results: App → GHL" },
  { key: "oat", label: "OAT" },
  { key: "keener", label: "Keener" },
];

type Row = {
  accountLabel: string;
  locationId: string;
  field: MappingFieldMeta;
  mapping?: GhlFieldMapping;
  status: ReturnType<typeof resolveMappingDisplayStatus>;
};

function buildRows(mappingsByLocation: Map<string, Map<string, GhlFieldMapping>>) {
  const rows: Row[] = [];
  for (const account of GHL_IMPORT_ACCOUNTS) {
    const accountMappings = mappingsByLocation.get(account.ghlLocationId) ?? new Map();
    for (const field of [...leadImportFieldMeta, ...quoteResultFieldMeta]) {
      const mapping = accountMappings.get(field.key);
      rows.push({
        accountLabel: account.label,
        locationId: account.ghlLocationId,
        field,
        mapping,
        status: resolveMappingDisplayStatus(field, mapping, account.ghlLocationId),
      });
    }
  }
  return rows;
}

export function GhlMappingOverview({
  mappingsByLocation,
}: {
  mappingsByLocation: Map<string, Map<string, GhlFieldMapping>>;
}) {
  const [filter, setFilter] = useState<FilterKey>("critical");
  const rows = useMemo(() => buildRows(mappingsByLocation), [mappingsByLocation]);

  const filteredRows = rows.filter((row) => {
    if (filter === "critical") return row.field.indicators.includes("critical");
    if (filter === "missing") return !isMappingEffectivelyMapped(row.field, row.mapping, row.locationId);
    if (filter === "intake") return row.field.direction === "ghl-to-app";
    if (filter === "results") return row.field.direction === "app-to-ghl";
    if (filter === "oat") return row.locationId === GHL_IMPORT_ACCOUNTS[0].ghlLocationId;
    if (filter === "keener") return row.locationId === GHL_IMPORT_ACCOUNTS[1].ghlLocationId;
    return true;
  });

  const criticalMissing = rows.filter(
    (row) => row.status.tone === "critical",
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">What matters right now</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Imports need pickup/delivery, customer, and vehicle fields mapped for each account.</li>
          <li>The live quote link (Public Acceptance URL) is the most important write-back field.</li>
          <li>Quote PDF URL is optional — customers can approve from the live link without a PDF.</li>
          <li>Sync writes are disabled on staging; manual sync validates only.</li>
        </ul>
      </div>

      {criticalMissing.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Critical missing mappings ({criticalMissing.length})</p>
          <p className="mt-1">These may prevent imports from filling route, customer, or vehicle data.</p>
          <ul className="mt-2 space-y-1">
            {criticalMissing.slice(0, 8).map((row) => (
              <li key={`${row.locationId}-${row.field.key}`}>
                {row.accountLabel}: {row.field.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === item.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Account</th>
              <th className="p-3">App field</th>
              <th className="p-3">Direction</th>
              <th className="p-3">GHL field</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.locationId}-${row.field.key}`} className="border-t align-top">
                <td className="p-3">
                  <p className="font-medium">{row.accountLabel}</p>
                </td>
                <td className="p-3">
                  <p className="font-medium">{row.field.label}</p>
                  <GhlFieldIndicatorBadges indicators={row.field.indicators} className="mt-2" />
                </td>
                <td className="p-3 whitespace-nowrap">{row.field.direction === "ghl-to-app" ? "GHL → App" : "App → GHL"}</td>
                <td className="p-3">
                  {(() => {
                    const known = knownGhlFieldRefForLocation(row.locationId, row.field.key);
                    const effectiveName =
                      row.mapping?.ghlCustomFieldName ?? known?.ghlCustomFieldName ?? known?.ghlFieldKey;
                    const effectiveId = effectiveKnownFieldId(row.mapping, row.locationId, row.field.key);
                    const effectiveFallback = effectiveKnownFallback(row.mapping, row.locationId, row.field.key);
                    return (
                      <>
                        <p>{effectiveName ?? "—"}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{effectiveId ?? effectiveFallback ?? "—"}</p>
                      </>
                    );
                  })()}
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      row.status.tone === "ok" && "bg-emerald-100 text-emerald-800",
                      row.status.tone === "critical" && "bg-amber-100 text-amber-900",
                      row.status.tone === "muted" && "bg-slate-100 text-slate-700",
                      row.status.tone === "warn" && "bg-orange-100 text-orange-900",
                    )}
                  >
                    {row.status.label}
                  </span>
                  {row.status.helpText ? <p className="mt-1 text-xs text-muted-foreground">{row.status.helpText}</p> : null}
                </td>
              </tr>
            ))}
            {!filteredRows.length ? (
              <tr>
                <td colSpan={5} className="p-6 text-muted-foreground">
                  No mappings match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
