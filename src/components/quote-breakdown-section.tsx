"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { QuoteFeeRowData } from "@/lib/quote-form-preview";
import { getFeeRowId } from "@/lib/quote-form-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ManagedBreakdownFee = QuoteFeeRowData & { rowId: string; isNew?: boolean };

type BreakdownContextValue = {
  breakdownFees: ManagedBreakdownFee[];
  addBreakdownLine: () => void;
  removeBreakdownLine: (rowId: string) => void;
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

  function addBreakdownLine() {
    const rowId = `breakdown-${Date.now()}`;
    setFees((current) => [
      ...current,
      {
        rowId,
        feeType: "CUSTOM",
        label: "",
        amount: 0,
        isEnabled: true,
        showOnPdf: true,
        isInternalOnly: false,
        internalNote: null,
        sortOrder: current.length + 1,
        isNew: true,
      },
    ]);
  }

  function removeBreakdownLine(rowId: string) {
    setFees((current) => current.filter((fee) => fee.rowId !== rowId));
  }

  const value = useMemo(
    () => ({ breakdownFees: fees, addBreakdownLine, removeBreakdownLine }),
    [fees],
  );

  return <BreakdownContext.Provider value={value}>{children}</BreakdownContext.Provider>;
}

export function QuoteBreakdownSection({ showItemizedBreakdown }: { showItemizedBreakdown: boolean }) {
  const { breakdownFees, addBreakdownLine, removeBreakdownLine } = useBreakdownEditor();

  return (
    <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">Optional customer price breakdown</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Leave this off to show one clean transportation service price on the customer quote.
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
          <input
            type="checkbox"
            id="showItemizedBreakdown"
            name="showItemizedBreakdown"
            defaultChecked={showItemizedBreakdown}
            className="h-4 w-4 rounded border"
          />
          <span className="font-medium">Show itemized breakdown on customer quote</span>
        </label>
      </div>

      <div className="space-y-3">
        {breakdownFees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No breakdown lines added.</p>
        ) : null}
        {breakdownFees.map((fee, index) => (
          <div key={fee.rowId} className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-[1fr_140px_auto] md:items-end">
            <input type="hidden" name="feeRowId" value={fee.rowId} />
            <input type="hidden" name={`feeType_${fee.rowId}`} value="CUSTOM" />
            <input type="hidden" name={`feeSortOrder_${fee.rowId}`} value={String(fee.sortOrder || index + 1)} />
            <div className="space-y-2">
              <Label htmlFor={`feeLabel_${fee.rowId}`}>Label</Label>
              <Input id={`feeLabel_${fee.rowId}`} name={`feeLabel_${fee.rowId}`} defaultValue={fee.label} placeholder="e.g. Enclosed upgrade" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`feeAmount_${fee.rowId}`}>Amount</Label>
              <Input
                id={`feeAmount_${fee.rowId}`}
                name={`feeAmount_${fee.rowId}`}
                type="number"
                step="0.01"
                defaultValue={fee.amount.toString()}
                className="text-right font-medium"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pb-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="feeCustomerVisible"
                  value={fee.rowId}
                  defaultChecked={fee.showOnPdf && !fee.isInternalOnly}
                  className="h-4 w-4 rounded border"
                />
                Customer-visible
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="feeInternalOnly"
                  value={fee.rowId}
                  defaultChecked={fee.isInternalOnly}
                  className="h-4 w-4 rounded border"
                />
                Internal only
              </label>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeBreakdownLine(fee.rowId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addBreakdownLine}>
        <Plus className="h-4 w-4" /> Add breakdown line
      </Button>
    </div>
  );
}
