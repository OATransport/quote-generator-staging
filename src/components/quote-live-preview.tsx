"use client";

import { cn, currency } from "@/lib/utils";
import type { QuoteFormPreview } from "@/lib/quote-form-preview";
import { LiveQuoteLinkField } from "@/components/live-quote-link-field";
import { QuoteFieldBadge } from "@/components/quote-field-badge";
import { getQuoteModelConfig, quoteModelTitle } from "@/lib/quote-model";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function QuoteLivePreview({
  preview,
  customerName,
  liveQuoteUrl,
  quoteMode,
  ghlOpportunityId,
  syncStatusLabel,
  syncFeedbackMessage,
  syncFeedbackStatus,
}: {
  preview: QuoteFormPreview;
  customerName: string;
  liveQuoteUrl: string;
  quoteMode: string;
  ghlOpportunityId: string | null;
  syncStatusLabel: string;
  syncFeedbackMessage?: string | null;
  syncFeedbackStatus?: string | null;
}) {
  const activeMode = preview.quoteMode || quoteMode;
  const model = getQuoteModelConfig(activeMode);
  const showBrokerInternal = model.showBrokerFormula;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-sky-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Customer quote preview</CardTitle>
            <QuoteFieldBadge variant="customer-visible" />
          </div>
          <CardDescription>
            {quoteModelTitle(activeMode)} — what the customer sees on the public live quote page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <SummaryRow label="Customer" value={customerName} />
          <SummaryRow label="Route" value={preview.routeSummary} />
          <SummaryRow label="Vehicle" value={preview.vehicleSummary} />
          <div className="space-y-2 border-t pt-3">
            <SummaryMetric label={model.customerServicePriceLabel} value={currency(preview.customerTotal)} emphasis />
            <div className="grid grid-cols-2 gap-3">
              <SummaryMetric label={model.depositLabel} value={currency(preview.depositDue)} />
              <SummaryMetric label={model.balanceDueLabel} value={currency(preview.balanceDue)} />
            </div>
          </div>
          {preview.showItemizedBreakdown && preview.breakdownLineItems.some((item) => item.isCustomerVisible) ? (
            <div className="space-y-1 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Itemized breakdown</p>
              {preview.breakdownLineItems
                .filter((item) => item.isCustomerVisible)
                .map((item) => (
                  <div key={item.rowId} className="flex justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="font-medium">{currency(item.amount)}</span>
                  </div>
                ))}
            </div>
          ) : null}
          <div className="border-t pt-3">
            <LiveQuoteLinkField url={liveQuoteUrl} label="Live quote link" helperText="" inputId="liveQuoteLinkPreview" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200/80 bg-amber-50/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Internal preview</CardTitle>
            <QuoteFieldBadge variant="internal-only" />
          </div>
          <CardDescription>
            {showBrokerInternal ? "Carrier pay and broker margin — never shown publicly." : "Direct service internal math — never shown publicly."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {showBrokerInternal ? (
            <div className="grid grid-cols-2 gap-3">
              <SummaryMetric label="Carrier pay" value={currency(preview.carrierPay)} />
              <SummaryMetric label="Broker fee" value={currency(preview.grossMargin)} emphasis />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <SummaryMetric label={model.carrierPayLabel} value={preview.carrierPay > 0 ? currency(preview.carrierPay) : "—"} />
              <SummaryMetric label="Estimated margin" value={preview.carrierPay > 0 ? currency(preview.grossMargin) : "—"} emphasis />
            </div>
          )}
          <SummaryRow
            label="Margin %"
            value={preview.marginPercentage == null ? "Enter customer price" : `${preview.marginPercentage.toFixed(1)}%`}
          />
          <div className="space-y-1 border-t border-amber-200/60 pt-3">
            <SummaryRow label="GHL opportunity" value={ghlOpportunityId ?? "—"} mono />
            <SummaryRow label="Quote model" value={quoteModelTitle(activeMode)} />
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

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", mono && "break-all font-mono text-xs")}>{value}</span>
    </div>
  );
}

function SummaryMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", emphasis ? "text-lg text-primary" : "text-base")}>{value}</p>
    </div>
  );
}
