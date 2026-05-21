"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { QuoteFormPreview } from "@/lib/quote-form-preview";
import type { QuoteFeeRowData } from "@/lib/quote-form-preview";
import { getFeeRowId } from "@/lib/quote-form-preview";
import { breakdownModeFromToggle } from "@/lib/quote-breakdown";
import { CUSTOMER_LINE_PRESETS } from "@/lib/pricing-build-mode";
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

  function handleModeChange(nextMode: "simple" | "itemized") {
    setMode(nextMode);
    requestAnimationFrame(() => onPreviewRefresh?.());
  }

  useEffect(() => {
    setMode(breakdownModeFromToggle(showItemizedBreakdown));
  }, [showItemizedBreakdown]);

  useEffect(() => {
    if (mode !== "itemized") return;
    const input = document.getElementById("customerTransportationPrice") as HTMLInputElement | null;
    if (!input) return;
    input.value = preview.breakdownTotal.toFixed(2);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [mode, preview.breakdownTotal]);

  return (
    <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="space-y-3">
        <div>
          <p className="font-medium">Pricing build mode</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose whether the customer total is entered directly or built from customer line items.
          </p>
        </div>

        <input type="hidden" name="breakdownMode" value={mode} readOnly />

        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Pricing build mode">
          <BreakdownModeCard
            title="Simple Transportation Price"
            description="Enter the transportation service price manually. Public quote shows one clean line."
            selected={mode === "simple"}
            onSelect={() => handleModeChange("simple")}
          />
          <BreakdownModeCard
            title="Build Price From Itemized Breakdown"
            description="Customer line items automatically build the transportation service price."
            selected={mode === "itemized"}
            onSelect={() => handleModeChange("itemized")}
          />
        </div>
      </div>

      {mode === "simple" ? (
        <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
          Transportation Service Price is manually entered above. Public quote will show{" "}
          <span className="font-medium text-foreground">Vehicle Transportation Service — {currency(preview.customerTotal)}</span>.
          Use internal-only cost rows below if needed — they never change the customer total.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            Transportation Service Price is calculated from customer line items:{" "}
            <span className="font-semibold">{currency(preview.breakdownTotal)}</span>. Editing line items updates the
            customer total immediately.
          </div>
          <p className="text-sm text-muted-foreground">
            Use itemized pricing only when you want the customer to see the line items that make up the total.
          </p>

          <div className="flex flex-wrap gap-2">
            {CUSTOMER_LINE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  addBreakdownLine({ label: preset.label, amount: preset.amount, visibility: "customer" });
                  onPreviewRefresh?.();
                }}
              >
                Add {preset.label}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {breakdownFees.filter((fee) => !fee.isInternalOnly).length === 0 ? (
              <p className="text-sm text-muted-foreground">Add customer line items to build the transportation price.</p>
            ) : null}
            {breakdownFees
              .filter((fee) => !fee.isInternalOnly)
              .map((fee, index) => (
                <BreakdownRow
                  key={fee.rowId}
                  fee={fee}
                  index={index}
                  onRemove={() => removeBreakdownLine(fee.rowId)}
                  onFieldChange={onPreviewRefresh}
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

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              addBreakdownLine({ visibility: "customer" });
              onPreviewRefresh?.();
            }}
          >
            <Plus className="h-4 w-4" /> Add customer line item
          </Button>
        </>
      )}

      <div className="space-y-3 border-t pt-4">
        <div>
          <p className="text-sm font-medium">Internal-only cost rows</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional internal costs for dispatch math. Never shown on the public quote and never counted toward the
            customer total.
          </p>
        </div>
        {breakdownFees.filter((fee) => fee.isInternalOnly).map((fee, index) => (
          <BreakdownRow
            key={fee.rowId}
            fee={fee}
            index={index}
            forceInternal
            onRemove={() => removeBreakdownLine(fee.rowId)}
            onFieldChange={onPreviewRefresh}
            onVisibilityChange={(visibility) => {
              updateBreakdownFee(fee.rowId, {
                isInternalOnly: visibility === "internal",
                showOnPdf: visibility === "customer",
              });
              onPreviewRefresh?.();
            }}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            addBreakdownLine({ visibility: "internal" });
            onPreviewRefresh?.();
          }}
        >
          <Plus className="h-4 w-4" /> Add internal-only cost
        </Button>
      </div>
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
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-background hover:border-primary/30"
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
  forceInternal,
  onRemove,
  onFieldChange,
  onVisibilityChange,
}: {
  fee: ManagedBreakdownFee;
  index: number;
  forceInternal?: boolean;
  onRemove: () => void;
  onFieldChange?: () => void;
  onVisibilityChange: (visibility: "customer" | "internal") => void;
}) {
  const visibility = forceInternal ? "internal" : feeVisibility(fee);

  return (
    <div className="grid gap-3 rounded-lg border bg-background p-4 lg:grid-cols-[1fr_140px_180px_auto] lg:items-end">
      <input type="hidden" name="feeRowId" value={fee.rowId} />
      <input type="hidden" name={`feeType_${fee.rowId}`} value="CUSTOM" />
      <input type="hidden" name={`feeSortOrder_${fee.rowId}`} value={String(fee.sortOrder || index + 1)} />
      {forceInternal ? <input type="hidden" name={`feeVisibility_${fee.rowId}`} value="internal" /> : null}
      <div className="space-y-2">
        <Label htmlFor={`feeLabel_${fee.rowId}`}>Label</Label>
        <Input
          id={`feeLabel_${fee.rowId}`}
          name={`feeLabel_${fee.rowId}`}
          defaultValue={fee.label}
          placeholder="e.g. Base Transport"
          onInput={onFieldChange}
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
          onInput={onFieldChange}
        />
      </div>
      {!forceInternal ? (
        <div className="space-y-2">
          <Label htmlFor={`feeVisibility_${fee.rowId}`}>Visibility</Label>
          <select
            id={`feeVisibility_${fee.rowId}`}
            name={`feeVisibility_${fee.rowId}`}
            defaultValue={visibility}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            onChange={(event) => onVisibilityChange(event.target.value as "customer" | "internal")}
          >
            <option value="customer">Customer line item</option>
            <option value="internal">Internal-only cost</option>
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Visibility</Label>
          <p className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
            Internal-only cost
          </p>
        </div>
      )}
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="self-end">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
