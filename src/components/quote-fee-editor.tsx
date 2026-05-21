"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { QuoteFeeRow } from "@/components/quote-fee-row";
import { QuoteFieldBadge } from "@/components/quote-field-badge";
import type { QuoteFeeRowData } from "@/lib/quote-form-preview";
import { getFeeRowId } from "@/lib/quote-form-preview";
import { getFeeRowHelperText } from "@/lib/customer-quote-fees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ManagedFee = QuoteFeeRowData & { rowId: string; isNew?: boolean };

type FeeEditorContextValue = {
  customerFees: ManagedFee[];
  carrierFees: ManagedFee[];
  internalFees: ManagedFee[];
  moveToInternal: (rowId: string) => void;
  addCustomFee: (section: "customer" | "carrier" | "internal") => void;
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
  section: "customer" | "carrier" | "internal";
  onMoveToInternal?: (rowId: string) => void;
}) {
  const { rowId } = fee;
  const helperText = getFeeRowHelperText(fee);

  return (
    <div
      className={
        section === "customer"
          ? "rounded-lg border bg-card p-4"
          : section === "carrier"
            ? "rounded-lg border border-indigo-200/60 bg-indigo-50/20 p-4"
            : "rounded-lg border border-amber-200/60 bg-amber-50/30 p-4"
      }
    >
      <input type="hidden" name="feeRowId" value={rowId} />
      <input type="hidden" name={`feeType_${rowId}`} value={section === "carrier" ? "CARRIER_PAY" : "CUSTOM"} />
      <input type="hidden" name={`feeSortOrder_${rowId}`} value={String(fee.sortOrder || index + 1)} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="feeEnabled" value={rowId} defaultChecked={fee.isEnabled} className="h-4 w-4 rounded border" />
            Enabled
          </label>
          <Input name={`feeLabel_${rowId}`} defaultValue={fee.label} placeholder="Line item label" />
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
            <QuoteFieldBadge variant="customer-visible" />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="feeShowOnPdf" value={rowId} defaultChecked={fee.showOnPdf} className="h-4 w-4 rounded border" />
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
            <Textarea
              name={`feeInternalNote_${rowId}`}
              defaultValue={fee.internalNote ?? ""}
              placeholder={section === "carrier" ? "Carrier-facing notes (internal only)" : "Internal note (never shown to customer)"}
              className="min-h-9 text-sm"
            />
          </>
        )}
        <p className="text-xs leading-5 text-muted-foreground">{helperText}</p>
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
  const carrierFees = useMemo(
    () => fees.filter((fee) => fee.isInternalOnly && fee.feeType === "CARRIER_PAY"),
    [fees],
  );
  const internalFees = useMemo(
    () => fees.filter((fee) => fee.isInternalOnly && fee.feeType !== "CARRIER_PAY"),
    [fees],
  );

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

  function addCustomFee(section: "customer" | "carrier" | "internal") {
    const rowId = `new-${section}-${Date.now()}`;
    setFees((current) => [
      ...current,
      {
        rowId,
        feeType: section === "carrier" ? "CARRIER_PAY" : "CUSTOM",
        label: section === "carrier" ? "Carrier pay" : "",
        amount: 0,
        isEnabled: false,
        showOnPdf: section === "customer",
        isInternalOnly: section !== "customer",
        internalNote: "",
        sortOrder: current.length + 1,
        isNew: true,
      },
    ]);
  }

  return (
    <FeeEditorContext.Provider value={{ customerFees, carrierFees, internalFees, moveToInternal, addCustomFee }}>
      {children}
    </FeeEditorContext.Provider>
  );
}

function renderFeeRows(
  fees: ManagedFee[],
  section: "customer" | "carrier" | "internal",
  moveToInternal?: (rowId: string) => void,
) {
  return fees.map((fee, index) =>
    fee.isNew ? (
      <CustomFeeRow key={fee.rowId} fee={fee} index={index} section={section} onMoveToInternal={moveToInternal} />
    ) : (
      <QuoteFeeRow key={fee.rowId} fee={fee} index={index} section={section} onMoveToInternal={moveToInternal} />
    ),
  );
}

export function QuoteFeeCustomerSection() {
  const { customerFees, moveToInternal, addCustomFee } = useFeeEditor();

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
        Enable line items that add to the customer quote total, or show informational items on the live quote without changing the total.
      </div>
      {customerFees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customer-facing line items yet.</p>
      ) : null}
      {renderFeeRows(customerFees, "customer", moveToInternal)}
      <Button type="button" variant="outline" size="sm" onClick={() => addCustomFee("customer")}>
        <Plus className="h-4 w-4" /> Add customer line item
      </Button>
    </div>
  );
}

export function QuoteFeeCarrierSection() {
  const { carrierFees, addCustomFee } = useFeeEditor();

  return (
    <div className="space-y-3">
      {carrierFees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No carrier offer entered yet.</p>
      ) : null}
      {renderFeeRows(carrierFees, "carrier")}
      <Button type="button" variant="outline" size="sm" onClick={() => addCustomFee("carrier")}>
        <Plus className="h-4 w-4" /> Add carrier line item
      </Button>
    </div>
  );
}

export function QuoteFeeInternalSection() {
  const { internalFees, addCustomFee } = useFeeEditor();

  return (
    <div className="space-y-3">
      {internalFees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No internal-only costs added yet.</p>
      ) : null}
      {renderFeeRows(internalFees, "internal")}
      <Button type="button" variant="outline" size="sm" onClick={() => addCustomFee("internal")}>
        <Plus className="h-4 w-4" /> Add internal cost
      </Button>
    </div>
  );
}
