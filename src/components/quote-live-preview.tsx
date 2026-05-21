"use client";

import { cn, currency } from "@/lib/utils";
import type { QuoteFormPreview } from "@/lib/quote-form-preview";
import { LiveQuoteLinkField } from "@/components/live-quote-link-field";
import { QuoteFieldBadge } from "@/components/quote-field-badge";
import { quoteModeLabel } from "@/lib/quote";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function QuoteLivePreview({
  preview,
  customerName,
  vehicleSummary,
  liveQuoteUrl,
  quoteMode,
  ghlOpportunityId,
  syncStatusLabel,
  syncFeedbackMessage,
  syncFeedbackStatus,
}: {
  preview: QuoteFormPreview;
  customerName: string;
  vehicleSummary: string;
  liveQuoteUrl: string;
  quoteMode: string;
  ghlOpportunityId: string | null;
  syncStatusLabel: string;
  syncFeedbackMessage?: string | null;
  syncFeedbackStatus?: string | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-sky-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Customer-facing quote</CardTitle>
            <QuoteFieldBadge variant="customer-visible" />
          </div>
          <CardDescription>Live preview — updates as you edit pricing below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <SummaryRow label="Customer" value={customerName} />
          <SummaryRow label="Route" value={preview.routeSummary} />
          <SummaryRow label="Vehicle" value={vehicleSummary} />
          <div className="grid grid-cols-3 gap-3 border-t pt-3">
            <SummaryMetric label="Customer total" value={currency(preview.customerTotal)} />
            <SummaryMetric label="Deposit due" value={currency(preview.depositDue)} />
            <SummaryMetric label="Balance due" value={currency(preview.balanceDue)} />
          </div>
          {preview.customerLineItems.length > 0 ? (
            <div className="space-y-1 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Line items</p>
              {preview.customerLineItems.map((fee) => (
                <div key={fee.rowId} className="flex justify-between gap-2">
                  <span>{fee.label}</span>
                  <span className="font-medium">{currency(fee.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="border-t pt-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live quote link</p>
              <QuoteFieldBadge variant="live-link-primary" />
            </div>
            <LiveQuoteLinkField url={liveQuoteUrl} label="" helperText="" inputId="liveQuoteLinkPreview" />
          </div>
          {preview.customerNotes ? (
            <div className="rounded-md bg-muted/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer notes</p>
              <p className="mt-1 whitespace-pre-wrap">{preview.customerNotes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-amber-200/80 bg-amber-50/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Internal dispatch view</CardTitle>
            <QuoteFieldBadge variant="internal-only" />
          </div>
          <CardDescription>Live margin preview — never shown on public quote pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <SummaryMetric label="Carrier pay" value={currency(preview.carrierPay)} />
            <SummaryMetric
              label="Est. gross profit"
              value={currency(preview.grossMargin)}
              highlight={preview.grossMargin >= 0 ? "positive" : "negative"}
            />
          </div>
          <SummaryRow
            label="Margin"
            value={preview.marginPercentage == null ? "—" : `${preview.marginPercentage.toFixed(1)}%`}
          />
          {preview.internalLineItems.length > 0 ? (
            <div className="space-y-1 border-t border-amber-200/60 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal line items</p>
              {preview.internalLineItems.map((fee) => (
                <div key={fee.rowId} className="flex justify-between gap-2">
                  <span>{fee.label}</span>
                  <span className="font-medium">{currency(fee.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {preview.internalNotes ? (
            <div className="rounded-md border border-amber-200/60 bg-background/80 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Internal notes</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{preview.internalNotes}</p>
            </div>
          ) : null}
          <div className="space-y-1 border-t border-amber-200/60 pt-3">
            <SummaryRow label="GHL opportunity" value={ghlOpportunityId ?? "—"} mono />
            <SummaryRow label="Quote mode" value={quoteModeLabel(quoteMode)} />
            <SummaryRow label="Sync status" value={syncStatusLabel} />
            {syncFeedbackMessage ? (
              <div className="rounded-md border bg-background/80 p-2 text-xs">
                <span className="font-medium">{syncFeedbackStatus ?? "SYNC"}:</span> {syncFeedbackMessage}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function QuoteProfitSummary({ preview }: { preview: QuoteFormPreview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ProfitMetric label="Customer total" value={currency(preview.customerTotal)} />
      <ProfitMetric label="Deposit" value={currency(preview.depositDue)} />
      <ProfitMetric label="Balance" value={currency(preview.balanceDue)} />
      <ProfitMetric label="Carrier pay" value={currency(preview.carrierPay)} internal />
      <ProfitMetric
        label="Est. gross profit"
        value={currency(preview.grossMargin)}
        emphasis
        positive={preview.grossMargin >= 0}
      />
      <ProfitMetric
        label="Est. margin"
        value={preview.marginPercentage == null ? "—" : `${preview.marginPercentage.toFixed(1)}%`}
        emphasis
        positive={preview.marginPercentage == null || preview.marginPercentage >= 0}
      />
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", mono && "break-all font-mono text-xs")}>{value}</span>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-base font-semibold",
          highlight === "positive" && "text-emerald-700",
          highlight === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ProfitMetric({
  label,
  value,
  emphasis,
  positive,
  internal,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  positive?: boolean;
  internal?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-background p-4", internal && "border-amber-200/60")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold",
          emphasis ? "text-2xl" : "text-lg",
          positive === false && "text-destructive",
          positive === true && emphasis && "text-emerald-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}
