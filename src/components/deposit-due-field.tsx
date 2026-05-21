"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRecommendedDeposit, isDepositManuallySet } from "@/lib/quote-pricing";
import { hasDepositDue } from "@/lib/public-quote-deposit";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DepositDueFieldProps = {
  customerTotal: number;
  currentDeposit: number;
  initialDeposit: number;
  depositLabel: string;
  onPreviewRefresh?: () => void;
};

export function DepositDueField({
  customerTotal,
  currentDeposit,
  initialDeposit,
  depositLabel,
  onPreviewRefresh,
}: DepositDueFieldProps) {
  const recommended = getRecommendedDeposit(customerTotal);
  const [manualOverride, setManualOverride] = useState(() => isDepositManuallySet(initialDeposit, customerTotal));
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCustomerTotalRef = useRef(customerTotal);
  const didInitialAutoFill = useRef(false);

  const syncDepositValue = useCallback(
    (nextDeposit: number) => {
      const input = inputRef.current;
      if (!input) return;
      input.value = nextDeposit.toFixed(2);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      onPreviewRefresh?.();
    },
    [onPreviewRefresh],
  );

  useEffect(() => {
    if (didInitialAutoFill.current) return;
    didInitialAutoFill.current = true;
    if (!manualOverride && initialDeposit === 0 && recommended > 0) {
      syncDepositValue(recommended);
    }
  }, [initialDeposit, manualOverride, recommended, syncDepositValue]);

  useEffect(() => {
    if (prevCustomerTotalRef.current === customerTotal) return;
    prevCustomerTotalRef.current = customerTotal;
    if (!manualOverride) {
      syncDepositValue(getRecommendedDeposit(customerTotal));
    }
  }, [customerTotal, manualOverride, syncDepositValue]);

  function applyRecommended() {
    setManualOverride(false);
    syncDepositValue(recommended);
  }

  const showUseRecommended = manualOverride && recommended !== currentDeposit;

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <Label htmlFor="depositDue" className="text-sm font-semibold">
        {hasDepositDue(currentDeposit) ? depositLabel : "No Deposit Due Today"}
      </Label>
      <Input
        ref={inputRef}
        id="depositDue"
        name="depositDue"
        type="number"
        min="0"
        step="0.01"
        defaultValue={initialDeposit.toString()}
        className="mt-3 text-2xl font-bold"
        onInput={() => {
          setManualOverride(true);
          onPreviewRefresh?.();
        }}
      />
      <div className="mt-3 space-y-2">
        <p className="text-xs leading-5 text-muted-foreground">
          Recommended deposit is based on the transportation service price. You can override it if needed.
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Recommended deposit: </span>
          <span className="font-semibold">{currency(recommended)}</span>
        </p>
        {showUseRecommended ? (
          <Button type="button" variant="outline" size="sm" onClick={applyRecommended}>
            Use recommended deposit
          </Button>
        ) : null}
        {!manualOverride && recommended > 0 ? (
          <p className="text-xs text-sky-800">Deposit follows the recommended schedule for this service price.</p>
        ) : null}
      </div>
    </div>
  );
}
