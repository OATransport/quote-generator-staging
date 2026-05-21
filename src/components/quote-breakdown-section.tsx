"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import type { QuoteFormPreview } from "@/lib/quote-form-preview";
import type { QuoteFeeRowData } from "@/lib/quote-form-preview";
import { getFeeRowId } from "@/lib/quote-form-preview";
import {
  BASE_TRANSPORT_LINE_LABEL,
  breakdownModeFromToggle,
  formatBreakdownMismatchMessage,
} from "@/lib/quote-breakdown";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ManagedBreakdownFee = QuoteFeeRowData & { rowId: string; isNew?: boolean };

type BreakdownContextValue = {
  breakdownFees: ManagedBreakdownFee[];
  addBreakdownLine: (input?: { label?: string; amount?: number; visibility?: "customer" | "internal" }) => void;
  removeBreakdownLine: (rowId: string) => void;
  updateBreakdownFee: (rowId: string, patch: Partial<ManagedBreakdownFee>) => void;
};

const BreakdownContext = createContext<BreakdownContextValue | null>(null);

function useBreakdownEditor() {
  const value = useContext(BreakdownContext);
  if (!value) throw new Error("QuoteBreakdownSection must be used within QuoteBreakdownProvider");
  return value;
}

function toManagedFee(fee: QuoteFeeRowData): ManagedBreakdownFee {
  return { ...fee, rowId: getFeeRowId(fee) };
}

function feeVisibility(fee: QuoteFeeRowData): "customer" | "internal" {
  return fee.isInternalOnly ? "internal" : "customer";
}

export function QuoteBreakdownProvider({
  initialFees,
  onChange,
  children,
}: {
  initialFees: QuoteFeeRowData[];
  onChange?: () => void;
  children: React.ReactNode;
}) {
  const [fees, setFees] = useState<ManagedBreakdownFee[]>(() => initialFees.map(toManagedFee));
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onChange?.();
  }, [fees, onChange]);

  function addBreakdownLine(input?: { label?: string; amount?: number; visibility?: "customer" | "internal" }) {
    const rowId = `breakdown-${Date.now()}`;
    const visibility = input?.visibility ?? "customer";
    setFees((current) => [
      ...current,
      {
        rowId,
        feeType: "CUSTOM",
        label: input?.label ?? "",
        amount: input?.amount ?? 0,
        isEnabled: true,
        showOnPdf: visibility === "customer",
        isInternalOnly: visibility === "internal",
        internalNote: null,
        sortOrder: current.length + 1,
        isNew: true,
      },
    ]);
  }

  function removeBreakdownLine(rowId: string) {
    setFees((current) => current.filter((fee) => fee.rowId !== rowId));
  }

  function updateBreakdownFee(rowId: string, patch: Partial<ManagedBreakdownFee>) {
    setFees((current) => current.map((fee) => (fee.rowId === rowId ? { ...fee, ...patch } : fee)));
  }

  const value = useMemo(
    () => ({ breakdownFees: fees, addBreakdownLine, removeBreakdownLine, updateBreakdownFee }),
    [fees],
  );

  return <BreakdownContext.Provider value={value}>{children}</BreakdownContext.Provider>;
}

export function QuoteBreakdownSection({
  showItemizedBreakdown,
  preview,
  onPreviewRefresh,
}: {
  showItemizedBreakdown: boolean;
  preview: QuoteFormPreview;
  onPreviewRefresh?: () => void;
}) {
  const { breakdownFees, addBreakdownLine, removeBreakdownLine, updateBreakdownFee } = useBreakdownEditor();
  const initialMode = breakdownModeFromToggle(showItemizedBreakdown);
  const [mode, setMode] = useState<"simple" | "itemized">(initialMode);

  const customerBreakdownTotal = preview.breakdownTotal;
  const mismatchMessage =
    mode === "itemized" && customerBreakdownTotal > 0
      ? formatBreakdownMismatchMessage(preview.customerTotal, customerBreakdownTotal)
      : null;

  function handleModeChange(nextMode: "simple" | "itemized") {
    setMode(nextMode);
  }

  useEffect(() => {
    onPreviewRefresh?.();
  }, [mode, onPreviewRefresh]);

  function addBaseTransportLine() {
    const remaining = Math.round((preview.customerTotal - customerBreakdownTotal) * 100) / 100;
    if (remaining <= 0) return;
    addBreakdownLine({ label: BASE_TRANSPORT_LINE_LABEL, amount: remaining, visibility: "customer" });
    onPreviewRefresh?.();
  }

  function setServicePriceToBreakdownTotal() {
    const input = document.getElementById("customerTransportationPrice") as HTMLInputElement | null;
    if (!input || customerBreakdownTotal <= 0) return;
    input.value = customerBreakdownTotal.toFixed(2);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    onPreviewRefresh?.();
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="space-y-3">
        <div>
          <p className="font-medium">Optional customer price breakdown</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Most quotes should stay in Simple total mode. Use itemized breakdown only when you want the customer to see
            line items that add up to the transportation service price.
          </p>
        </div>

        <input type="hidden" name="breakdownMode" value={mode} readOnly />

        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Breakdown mode">
          <BreakdownModeCard
            title="Simple total"
            description="Public quote shows one clean vehicle transportation service price."
            selected={mode === "simple"}
            onSelect={() => handleModeChange("simple")}
          />
          <BreakdownModeCard
            title="Itemized customer breakdown"
            description="Public quote shows customer breakdown lines that should add up to the service price."
            selected={mode === "itemized"}
            onSelect={() => handleModeChange("itemized")}
          />
        </div>
      </div>

      {mode === "itemized" ? (
        <>
          <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
            Customer breakdown rows build the public itemized price. Internal-only rows stay off the customer quote and do
            not count toward the breakdown total.
          </div>

          <div className="space-y-3">
            {breakdownFees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No breakdown lines added yet.</p>
            ) : null}
            {breakdownFees.map((fee, index) => (
              <BreakdownRow
                key={fee.rowId}
                fee={fee}
                index={index}
                onRemove={() => removeBreakdownLine(fee.rowId)}
                onVisibilityChange={(visibility) => {
                  updateBreakdownFee(fee.rowId, {
                    isInternalOnly: visibility === "internal",
                    showOnPdf: visibility === "customer",
                  });
                  onPreviewRefresh?.();
                }}
              />
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => addBreakdownLine()}>
            <Plus className="h-4 w-4" /> Add breakdown line
          </Button>

          {mismatchMessage ? (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">{mismatchMessage}</p>
              <div className="flex flex-wrap gap-2">
                {preview.customerTotal > customerBreakdownTotal ? (
                  <Button type="button" size="sm" variant="secondary" onClick={addBaseTransportLine}>
                    <Wand2 className="h-4 w-4" /> Add base transport line for remaining amount (
                    {currency(preview.customerTotal - customerBreakdownTotal)})
                  </Button>
                ) : null}
                {customerBreakdownTotal > 0 ? (
                  <Button type="button" size="sm" variant="outline" onClick={setServicePriceToBreakdownTotal}>
                    Set service price to breakdown total ({currency(customerBreakdownTotal)})
                  </Button>
                ) : null}
              </div>
            </div>
          ) : mode === "itemized" && customerBreakdownTotal > 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Breakdown total matches transportation service price ({currency(customerBreakdownTotal)}).
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
          Public quote will show one line: Vehicle Transportation Service — {currency(preview.customerTotal)}.
        </div>
      )}
    </div>
  );
}

function BreakdownModeCard({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left transition ${
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-background hover:border-primary/30"
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

function BreakdownRow({
  fee,
  index,
  onRemove,
  onVisibilityChange,
}: {
  fee: ManagedBreakdownFee;
  index: number;
  onRemove: () => void;
  onVisibilityChange: (visibility: "customer" | "internal") => void;
}) {
  const visibility = feeVisibility(fee);

  return (
    <div className="grid gap-3 rounded-lg border bg-background p-4 lg:grid-cols-[1fr_140px_180px_auto] lg:items-end">
      <input type="hidden" name="feeRowId" value={fee.rowId} />
      <input type="hidden" name={`feeType_${fee.rowId}`} value="CUSTOM" />
      <input type="hidden" name={`feeSortOrder_${fee.rowId}`} value={String(fee.sortOrder || index + 1)} />
      <div className="space-y-2">
        <Label htmlFor={`feeLabel_${fee.rowId}`}>Label</Label>
        <Input
          id={`feeLabel_${fee.rowId}`}
          name={`feeLabel_${fee.rowId}`}
          defaultValue={fee.label}
          placeholder="e.g. Expedited Delivery Fee"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`feeAmount_${fee.rowId}`}>Amount</Label>
        <Input
          id={`feeAmount_${fee.rowId}`}
          name={`feeAmount_${fee.rowId}`}
          type="number"
          step="0.01"
          min="0"
          defaultValue={fee.amount.toString()}
          className="text-right font-medium"
          onInput={(event) => event.currentTarget.dispatchEvent(new Event("input", { bubbles: true }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`feeVisibility_${fee.rowId}`}>Visibility</Label>
        <select
          id={`feeVisibility_${fee.rowId}`}
          name={`feeVisibility_${fee.rowId}`}
          defaultValue={visibility}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          onChange={(event) => onVisibilityChange(event.target.value as "customer" | "internal")}
        >
          <option value="customer">Customer breakdown</option>
          <option value="internal">Internal only</option>
        </select>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="self-end">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
