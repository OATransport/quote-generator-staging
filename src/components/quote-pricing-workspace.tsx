"use client";

import type { QuoteFormPreview } from "@/lib/quote-form-preview";
import { getQuoteModelConfig } from "@/lib/quote-model";
import { QuoteBreakdownSection } from "@/components/quote-breakdown-section";
import { QuoteFieldBadge } from "@/components/quote-field-badge";
import { QuotePricingFormula } from "@/components/quote-pricing-formula";
import { currency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type QuotePricingWorkspaceProps = {
  quoteMode: string;
  preview: QuoteFormPreview;
  customerTotal: number;
  depositDue: number;
  carrierPay: number;
  showItemizedBreakdown: boolean;
  customerNotes: string;
  internalNotes: string;
  carrierNotes: string;
  onPreviewRefresh?: () => void;
};

export function QuotePricingWorkspace({
  quoteMode,
  preview,
  customerTotal,
  depositDue,
  carrierPay,
  showItemizedBreakdown,
  customerNotes,
  internalNotes,
  carrierNotes,
  onPreviewRefresh,
}: QuotePricingWorkspaceProps) {
  const model = getQuoteModelConfig(quoteMode);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-md ring-1 ring-black/5">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">Quote pricing</CardTitle>
          <CardDescription>{model.workspaceDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">Customer quote format</h3>
              <QuoteFieldBadge variant="customer-visible" />
            </div>
            <p className="text-sm text-muted-foreground">Used for the live customer quote link — {model.shortTitle} wording.</p>

            <div className="grid gap-4 lg:grid-cols-3">
              <PricingField
                id="customerTransportationPrice"
                name="customerTransportationPrice"
                label={model.customerServicePriceLabel}
                helper="The total price quoted to the customer."
                defaultValue={customerTotal}
                large
              />
              <PricingField
                id="depositDue"
                name="depositDue"
                label={model.depositLabel}
                helper="Amount collected when the customer accepts the quote."
                defaultValue={depositDue}
                large
              />
              <div className="rounded-xl border bg-muted/30 p-5">
                <Label className="text-sm font-medium">{model.balanceDueLabel}</Label>
                <p className="mt-3 text-3xl font-bold tracking-tight">{currency(preview.balanceDue)}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{model.balanceDueHelper}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerNotes">Customer notes</Label>
              <Textarea id="customerNotes" name="customerNotes" defaultValue={customerNotes} />
            </div>
          </section>

          {model.showCarrierPaySection ? (
            <section className="space-y-4 border-t pt-8">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{model.carrierSectionTitle}</h3>
                <QuoteFieldBadge variant="carrier-facing" />
              </div>
              <p className="text-sm text-muted-foreground">{model.carrierSectionDescription}</p>
              <div className="grid gap-4 lg:grid-cols-2">
                <PricingField
                  id="carrierPay"
                  name="carrierPay"
                  label={model.carrierPayLabel}
                  helper={model.carrierPayHelper}
                  defaultValue={carrierPay}
                  large
                />
                <div className="space-y-2">
                  <Label htmlFor="carrierNotes">Carrier-facing notes</Label>
                  <Textarea
                    id="carrierNotes"
                    name="carrierNotes"
                    defaultValue={carrierNotes}
                    placeholder="Dispatch notes for carrier negotiation"
                  />
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-4 border-t pt-8">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{model.internalSectionTitle}</h3>
              <QuoteFieldBadge variant="internal-only" />
            </div>
            <p className="text-sm text-muted-foreground">{model.internalSectionDescription}</p>

            {model.showBrokerFormula ? (
              <QuotePricingFormula
                customerPrice={preview.customerTotal}
                carrierPay={preview.carrierPay}
                brokerFee={preview.grossMargin}
              />
            ) : (
              <div className="rounded-xl border bg-gradient-to-r from-slate-50 via-white to-sky-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direct service pricing</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MetricTile label={model.customerServicePriceLabel} value={currency(preview.customerTotal)} />
                  <MetricTile
                    label="Service margin estimate"
                    value={preview.carrierPay > 0 ? currency(preview.grossMargin) : "Optional — add internal cost"}
                    accent={preview.carrierPay > 0}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label={model.customerServicePriceLabel} value={currency(preview.customerTotal)} />
              {model.showBrokerFormula ? (
                <>
                  <MetricTile label="Carrier pay" value={currency(preview.carrierPay)} />
                  <MetricTile label="Broker fee / gross profit" value={currency(preview.grossMargin)} accent />
                  <MetricTile
                    label="Margin %"
                    value={
                      preview.marginPercentage == null
                        ? preview.customerTotal <= 0
                          ? "Enter customer price"
                          : "—"
                        : `${preview.marginPercentage.toFixed(1)}%`
                    }
                  />
                </>
              ) : (
                <>
                  <MetricTile
                    label={model.carrierPayLabel}
                    value={preview.carrierPay > 0 ? currency(preview.carrierPay) : "—"}
                  />
                  <MetricTile
                    label="Estimated margin"
                    value={preview.carrierPay > 0 ? currency(preview.grossMargin) : "—"}
                    accent={preview.carrierPay > 0}
                  />
                  <MetricTile
                    label="Margin %"
                    value={
                      preview.carrierPay > 0 && preview.marginPercentage != null
                        ? `${preview.marginPercentage.toFixed(1)}%`
                        : "Add internal cost"
                    }
                  />
                </>
              )}
            </div>

            {model.showBrokerFormula && preview.carrierPay <= 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Enter carrier pay to calculate accurate broker fee and margin.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal notes</Label>
              <Textarea id="internalNotes" name="internalNotes" defaultValue={internalNotes} />
            </div>
          </section>

          <section className="space-y-4 border-t pt-8">
            <QuoteBreakdownSection
              showItemizedBreakdown={showItemizedBreakdown}
              preview={preview}
              onPreviewRefresh={onPreviewRefresh}
            />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function PricingField({
  id,
  name,
  label,
  helper,
  defaultValue,
  large,
}: {
  id: string;
  name: string;
  label: string;
  helper: string;
  defaultValue: number;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type="number"
        min="0"
        step="0.01"
        defaultValue={defaultValue.toString()}
        className={large ? "mt-3 text-2xl font-bold" : "mt-3 text-lg font-semibold"}
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

function MetricTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-bold ${accent ? "text-emerald-700" : ""}`}>{value}</p>
    </div>
  );
}
