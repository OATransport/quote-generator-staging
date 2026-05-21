"use client";

import { CheckCircle2 } from "lucide-react";
import { QUOTE_MODELS, type QuoteModelConfig } from "@/lib/quote-model";
import { cn } from "@/lib/utils";

type QuoteModelSelectorProps = {
  value: string;
  onChange: (mode: string) => void;
};

export function QuoteModelSelector({ value, onChange }: QuoteModelSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Quote model</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how this quote is priced and what the customer sees. This guides labels, helper text, and internal math.
        </p>
      </div>

      <input type="hidden" id="quoteMode" name="quoteMode" value={value} readOnly />

      <div className="grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Quote model">
        {QUOTE_MODELS.map((model) => (
          <QuoteModelCard
            key={model.mode}
            model={model}
            selected={value === model.mode}
            onSelect={() => onChange(model.mode)}
          />
        ))}
      </div>
    </div>
  );
}

function QuoteModelCard({
  model,
  selected,
  onSelect,
}: {
  model: QuoteModelConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative rounded-2xl border p-4 text-left transition shadow-sm",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border bg-background hover:border-primary/40 hover:bg-muted/20",
      )}
    >
      {selected ? (
        <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" aria-hidden />
      ) : null}
      <p className="pr-8 text-sm font-semibold leading-snug">{model.title}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{model.description}</p>
      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Customer:</span> {model.customerServicePriceLabel}
        </p>
        <p>
          <span className="font-medium text-foreground">Internal:</span>{" "}
          {model.showBrokerFormula ? "Carrier pay + broker fee" : "Direct service margin"}
        </p>
      </div>
    </button>
  );
}
