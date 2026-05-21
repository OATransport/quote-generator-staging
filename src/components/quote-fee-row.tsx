"use client";

import { QuoteFieldBadge } from "@/components/quote-field-badge";
import type { QuoteFeeRowData } from "@/lib/quote-form-preview";
import { getFeeRowId } from "@/lib/quote-form-preview";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function QuoteFeeRow({
  fee,
  index,
  section,
  onMoveToInternal,
}: {
  fee: QuoteFeeRowData;
  index: number;
  section: "customer" | "internal";
  onMoveToInternal?: (rowId: string) => void;
}) {
  const rowId = getFeeRowId(fee);
  const typeLabel = fee.feeType.replaceAll("_", " ");

  return (
    <div
      className={
        section === "internal"
          ? "rounded-lg border border-amber-200/60 bg-amber-50/30 p-4 transition-all duration-200"
          : "rounded-lg border bg-card p-4 transition-all duration-200"
      }
    >
      <input type="hidden" name="feeRowId" value={rowId} />
      <input type="hidden" name={`feeType_${rowId}`} value={fee.feeType} />
      <input type="hidden" name={`feeSortOrder_${rowId}`} value={String(fee.sortOrder || index + 1)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <label className="mt-2 flex shrink-0 items-center gap-2">
            <input
              type="checkbox"
              name="feeEnabled"
              value={rowId}
              defaultChecked={fee.isEnabled}
              className="h-4 w-4 rounded border"
            />
            <span className="sr-only">Enable {fee.label}</span>
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <Input name={`feeLabel_${rowId}`} defaultValue={fee.label} />
            <p className="text-xs text-muted-foreground">{typeLabel}</p>
          </div>
        </div>
        <div className="sm:w-36">
          <Input
            name={`feeAmount_${rowId}`}
            type="number"
            step="0.01"
            defaultValue={fee.amount.toString()}
            className="text-right font-medium"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {section === "customer" ? (
          <>
            <QuoteFieldBadge variant="customer-visible" />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="feeShowOnPdf"
                value={rowId}
                defaultChecked={fee.showOnPdf}
                className="h-4 w-4 rounded border"
              />
              <QuoteFieldBadge variant="optional-pdf" />
            </label>
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                value={rowId}
                className="h-4 w-4 rounded border"
                onChange={(event) => {
                  if (event.target.checked) onMoveToInternal?.(rowId);
                }}
              />
              Mark internal only
            </label>
            <p className="w-full text-xs text-muted-foreground">Moves to internal costs immediately. Save to persist.</p>
          </>
        ) : (
          <>
            <QuoteFieldBadge variant="internal-only" />
            <input type="hidden" name="feeInternalOnly" value={rowId} />
            {fee.showOnPdf ? <input type="hidden" name="feeShowOnPdf" value={rowId} /> : null}
            <div className="min-w-0 flex-1">
              <Textarea
                name={`feeInternalNote_${rowId}`}
                defaultValue={fee.internalNote ?? ""}
                placeholder="Internal note (never shown to customer)"
                className="min-h-9 text-sm"
              />
            </div>
          </>
        )}
      </div>

      {section === "customer" ? <input type="hidden" name={`feeInternalNote_${rowId}`} value={fee.internalNote ?? ""} /> : null}
    </div>
  );
}
