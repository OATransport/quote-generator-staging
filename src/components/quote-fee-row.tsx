"use client";

import { QuoteFieldBadge } from "@/components/quote-field-badge";
import type { QuoteFeeRowData } from "@/lib/quote-form-preview";
import { getFeeRowId } from "@/lib/quote-form-preview";
import { getFeeRowHelperText } from "@/lib/customer-quote-fees";
import { cn } from "@/lib/utils";
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
  section: "customer" | "carrier" | "internal";
  onMoveToInternal?: (rowId: string) => void;
}) {
  const rowId = getFeeRowId(fee);
  const typeLabel = fee.feeType.replaceAll("_", " ");
  const helperText = getFeeRowHelperText(fee);

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all duration-200",
        section === "customer" ? "bg-card" : section === "carrier" ? "border-indigo-200/60 bg-indigo-50/20" : "border-amber-200/60 bg-amber-50/30",
      )}
    >
      <input type="hidden" name="feeRowId" value={rowId} />
      <input type="hidden" name={`feeType_${rowId}`} value={fee.feeType} />
      <input type="hidden" name={`feeSortOrder_${rowId}`} value={String(fee.sortOrder || index + 1)} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="feeEnabled"
                value={rowId}
                defaultChecked={fee.isEnabled}
                className="h-4 w-4 rounded border"
              />
              Enabled
            </label>
            {section === "customer" ? (
              fee.isEnabled ? (
                <QuoteFieldBadge variant="adds-to-total" />
              ) : fee.showOnPdf ? (
                <QuoteFieldBadge variant="informational-only" />
              ) : (
                <QuoteFieldBadge variant="hidden-from-customer" />
              )
            ) : section === "carrier" ? (
              <QuoteFieldBadge variant="carrier-facing" />
            ) : (
              <QuoteFieldBadge variant="internal-only" />
            )}
          </div>

          <div className="space-y-2">
            <Input name={`feeLabel_${rowId}`} defaultValue={fee.label} />
            <p className="text-xs text-muted-foreground">{typeLabel}</p>
          </div>
        </div>

        <div className="w-full lg:w-40">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount</label>
          <Input
            name={`feeAmount_${rowId}`}
            type="number"
            step="0.01"
            defaultValue={fee.amount.toString()}
            className="text-right font-medium"
          />
        </div>
      </div>

      <div className="mt-3 space-y-3 border-t pt-3">
        {section === "customer" ? (
          <>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="feeShowOnPdf"
                value={rowId}
                defaultChecked={fee.showOnPdf}
                className="h-4 w-4 rounded border"
              />
              Show on customer quote
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="whitespace-nowrap">Visibility</span>
              <select
                defaultValue="customer"
                className="h-9 rounded-md border bg-background px-2 text-sm"
                onChange={(event) => {
                  if (event.target.value !== "customer") onMoveToInternal?.(rowId);
                }}
              >
                <option value="customer">Customer quote</option>
                <option value="internal">Move to internal costs</option>
              </select>
            </label>
            <input type="hidden" name={`feeInternalNote_${rowId}`} value={fee.internalNote ?? ""} />
          </>
        ) : (
          <>
            <input type="hidden" name="feeInternalOnly" value={rowId} />
            {fee.showOnPdf ? <input type="hidden" name="feeShowOnPdf" value={rowId} /> : null}
            <div className="min-w-0">
              <Textarea
                name={`feeInternalNote_${rowId}`}
                defaultValue={fee.internalNote ?? ""}
                placeholder={section === "carrier" ? "Carrier-facing notes (internal only)" : "Internal note (never shown to customer)"}
                className="min-h-9 text-sm"
              />
            </div>
          </>
        )}
        <p className="text-xs leading-5 text-muted-foreground">{helperText}</p>
      </div>
    </div>
  );
}
