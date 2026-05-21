"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { QuoteFeeRow } from "@/components/quote-fee-row";
import { QuoteFieldBadge } from "@/components/quote-field-badge";
import type { QuoteFeeRowData } from "@/lib/quote-form-preview";
import { getFeeRowId } from "@/lib/quote-form-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ManagedFee = QuoteFeeRowData & { rowId: string; isNew?: boolean };

type FeeEditorContextValue = {
  customerFees: ManagedFee[];
  internalFees: ManagedFee[];
  moveToInternal: (rowId: string) => void;
  addCustomFee: (section: "customer" | "internal") => void;
};

const FeeEditorContext = createContext<FeeEditorContextValue | null>(null);

function useFeeEditor() {
  const value = useContext(FeeEditorContext);
  if (!value) throw new Error("QuoteFeeEditor components must be used within QuoteFeeEditorProvider");
  return value;
}

function toManagedFee(fee: QuoteFeeRowData): ManagedFee {
  return { ...fee, rowId: getFeeRowId(fee) };
}

function CustomFeeRow({
  fee,
  index,
  section,
  onMoveToInternal,
}: {
  fee: ManagedFee;
  index: number;
  section: "customer" | "internal";
  onMoveToInternal?: (rowId: string) => void;
}) {
  const { rowId } = fee;
  const forceInternal = section === "internal";

  return (
    <div
      className={
        forceInternal
          ? "rounded-lg border border-amber-200/60 bg-amber-50/30 p-4 transition-all duration-200"
          : "rounded-lg border bg-card p-4 transition-all duration-200"
      }
    >
      <input type="hidden" name="feeRowId" value={rowId} />
      <input type="hidden" name={`feeType_${rowId}`} value="CUSTOM" />
      <input type="hidden" name={`feeSortOrder_${rowId}`} value={String(fee.sortOrder || index + 1)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <label className="mt-2 flex shrink-0 items-center gap-2">
            <input type="checkbox" name="feeEnabled" value={rowId} defaultChecked={fee.isEnabled} className="h-4 w-4 rounded border" />
            <span className="sr-only">Enable custom fee</span>
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <Input name={`feeLabel_${rowId}`} defaultValue={fee.label} placeholder="Custom fee label" />
            <p className="text-xs text-muted-foreground">Custom fee</p>
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
        {forceInternal ? (
          <>
            <QuoteFieldBadge variant="internal-only" />
            <input type="hidden" name="feeInternalOnly" value={rowId} />
            <div className="min-w-0 flex-1">
              <Textarea
                name={`feeInternalNote_${rowId}`}
                defaultValue={fee.internalNote ?? ""}
                placeholder="Internal note (never shown to customer)"
                className="min-h-9 text-sm"
              />
            </div>
          </>
        ) : (
          <>
            <QuoteFieldBadge variant="customer-visible" />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="feeShowOnPdf" value={rowId} defaultChecked={fee.showOnPdf} className="h-4 w-4 rounded border" />
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
            <input type="hidden" name={`feeInternalNote_${rowId}`} value={fee.internalNote ?? ""} />
          </>
        )}
      </div>
    </div>
  );
}

export function QuoteFeeEditorProvider({
  initialFees,
  onSectionsChange,
  children,
}: {
  initialFees: QuoteFeeRowData[];
  onSectionsChange?: () => void;
  children: React.ReactNode;
}) {
  const [fees, setFees] = useState<ManagedFee[]>(() => initialFees.map(toManagedFee));
  const mountedRef = useRef(false);

  const customerFees = useMemo(() => fees.filter((fee) => !fee.isInternalOnly), [fees]);
  const internalFees = useMemo(() => fees.filter((fee) => fee.isInternalOnly), [fees]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onSectionsChange?.();
  }, [fees, onSectionsChange]);

  function moveToInternal(rowId: string) {
    setFees((current) => current.map((fee) => (fee.rowId === rowId ? { ...fee, isInternalOnly: true } : fee)));
  }

  function addCustomFee(section: "customer" | "internal") {
    const rowId = `new-${section}-${Date.now()}`;
    setFees((current) => [
      ...current,
      {
        rowId,
        feeType: "CUSTOM",
        label: "",
        amount: 0,
        isEnabled: false,
        showOnPdf: section === "customer",
        isInternalOnly: section === "internal",
        internalNote: "",
        sortOrder: current.length + 1,
        isNew: true,
      },
    ]);
  }

  return (
    <FeeEditorContext.Provider value={{ customerFees, internalFees, moveToInternal, addCustomFee }}>
      {children}
    </FeeEditorContext.Provider>
  );
}

export function QuoteFeeCustomerSection() {
  const { customerFees, moveToInternal, addCustomFee } = useFeeEditor();

  return (
    <div className="space-y-3">
      {customerFees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customer-facing fees enabled. Add or enable fees below.</p>
      ) : null}
      {customerFees.map((fee, index) =>
        fee.isNew ? (
          <CustomFeeRow key={fee.rowId} fee={fee} index={index} section="customer" onMoveToInternal={moveToInternal} />
        ) : (
          <QuoteFeeRow key={fee.rowId} fee={fee} index={index} section="customer" onMoveToInternal={moveToInternal} />
        ),
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => addCustomFee("customer")}>
        <Plus className="h-4 w-4" /> Add custom customer fee
      </Button>
    </div>
  );
}

export function QuoteFeeInternalSection({ section }: { section: "carrier" | "internal" }) {
  const { internalFees, addCustomFee } = useFeeEditor();
  const visibleFees =
    section === "carrier"
      ? internalFees.filter((fee) => fee.feeType === "CARRIER_PAY")
      : internalFees.filter((fee) => fee.feeType !== "CARRIER_PAY");

  return (
    <div className="space-y-3">
      {section === "carrier" && visibleFees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No carrier pay entered yet. Enable Carrier Pay or add a custom carrier cost.</p>
      ) : null}
      {visibleFees.map((fee, index) =>
        fee.isNew ? (
          <CustomFeeRow key={fee.rowId} fee={fee} index={index} section="internal" />
        ) : (
          <QuoteFeeRow key={fee.rowId} fee={fee} index={index} section="internal" />
        ),
      )}
      {section === "internal" ? (
        <Button type="button" variant="outline" size="sm" onClick={() => addCustomFee("internal")}>
          <Plus className="h-4 w-4" /> Add custom internal cost
        </Button>
      ) : null}
    </div>
  );
}
