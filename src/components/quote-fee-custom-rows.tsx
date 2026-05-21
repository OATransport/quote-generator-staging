"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function QuoteFeeCustomRows({ startIndex }: { startIndex: number }) {
  const [rows, setRows] = useState<number[]>([]);

  return (
    <>
      {rows.map((row, index) => {
        const rowId = `new-${row}`;
        const sortOrder = startIndex + index + 1;
        return (
          <div key={rowId} className="grid gap-2 rounded-md border p-3 xl:grid-cols-[72px_180px_1fr_130px_110px_110px_1fr_90px]">
            <input type="hidden" name="feeRowId" value={rowId} />
            <input type="hidden" name={`feeType_${rowId}`} value="CUSTOM" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="feeEnabled" value={rowId} className="h-4 w-4" /> Enable
            </label>
            <div className="text-sm font-medium">Custom Fee</div>
            <Input name={`feeLabel_${rowId}`} placeholder="Custom fee label" />
            <Input name={`feeAmount_${rowId}`} type="number" step="0.01" defaultValue="0" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="feeShowOnPdf" value={rowId} className="h-4 w-4" defaultChecked /> PDF
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="feeInternalOnly" value={rowId} className="h-4 w-4" /> Internal
            </label>
            <Textarea name={`feeInternalNote_${rowId}`} placeholder="Internal note" className="min-h-10" />
            <Input name={`feeSortOrder_${rowId}`} type="number" defaultValue={sortOrder} />
          </div>
        );
      })}
      <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, Date.now()])}>
        <Plus className="h-4 w-4" /> Add custom fee
      </Button>
    </>
  );
}
