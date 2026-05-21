"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { updateQuoteAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/collapsible-section";
import {
  QuoteFeeCustomerSection,
  QuoteFeeEditorProvider,
  QuoteFeeInternalSection,
} from "@/components/quote-fee-editor";
import { QuoteLivePreview, QuoteProfitSummary } from "@/components/quote-live-preview";
import { QuoteFieldBadge } from "@/components/quote-field-badge";
import { buildPreviewFromFormElement, type QuoteFeeRowData, type QuoteFormPreview } from "@/lib/quote-form-preview";
import { quoteStatusOptions } from "@/lib/form-parsing";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PreviewContext = createContext<{
  preview: QuoteFormPreview;
  setPreview: (preview: QuoteFormPreview) => void;
} | null>(null);

function usePreviewContext() {
  const value = useContext(PreviewContext);
  if (!value) throw new Error("Quote edit preview context is missing");
  return value;
}

export function useQuotePreview() {
  return usePreviewContext().preview;
}

export function QuoteEditWorkspace({
  initialPreview,
  children,
}: {
  initialPreview: QuoteFormPreview;
  children: React.ReactNode;
}) {
  const [preview, setPreview] = useState(initialPreview);
  return <PreviewContext.Provider value={{ preview, setPreview }}>{children}</PreviewContext.Provider>;
}

export function QuoteLivePreviewPanel({
  quoteMode,
  previewContext,
}: {
  quoteMode: string;
  previewContext: QuotePreviewContextProps;
}) {
  const { preview } = usePreviewContext();
  return <QuoteLivePreview preview={preview} quoteMode={quoteMode} {...previewContext} />;
}

export function QuoteSidebarTotalsLive() {
  const { preview } = usePreviewContext();
  return <QuoteSidebarTotals preview={preview} />;
}

type QuotePreviewContextProps = {
  customerName: string;
  vehicleSummary: string;
  liveQuoteUrl: string;
  routeSummary: string;
  ghlOpportunityId: string | null;
  syncStatusLabel: string;
  syncFeedbackMessage?: string | null;
  syncFeedbackStatus?: string | null;
};

type QuoteEditFormProps = {
  quoteId: string;
  quoteMode: string;
  status: string;
  depositDue: number;
  customerNotes: string;
  internalNotes: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  trailerType: string;
  fees: QuoteFeeRowData[];
};

export function QuoteEditForm({
  quoteId,
  quoteMode,
  status,
  depositDue,
  customerNotes,
  internalNotes,
  pickupAddress,
  pickupCity,
  pickupState,
  pickupZip,
  deliveryAddress,
  deliveryCity,
  deliveryState,
  deliveryZip,
  trailerType,
  fees,
}: QuoteEditFormProps) {
  const { preview, setPreview } = usePreviewContext();
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);

  const refreshPreview = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    setPreview(buildPreviewFromFormElement(form));
  }, [setPreview]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleChange = () => {
      setIsDirty(true);
      refreshPreview();
    };

    form.addEventListener("input", handleChange);
    form.addEventListener("change", handleChange);
    return () => {
      form.removeEventListener("input", handleChange);
      form.removeEventListener("change", handleChange);
    };
  }, [refreshPreview]);

  return (
    <QuoteFeeEditorProvider initialFees={fees} onSectionsChange={refreshPreview}>
      <form ref={formRef} action={updateQuoteAction} className="space-y-6">
        <input type="hidden" name="quoteId" value={quoteId} />

        <Card>
          <CardHeader>
            <CardTitle>Shipment details</CardTitle>
            <CardDescription>
              Editable quote snapshot. Changes are saved locally and do not update GHL unless you manually sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CollapsibleSection title="Quote settings" description="Mode and workflow status for this quote." defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quoteMode">Quote mode</Label>
                  <select
                    id="quoteMode"
                    name="quoteMode"
                    defaultValue={quoteMode}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="OAT_DIRECT">OAT Direct</option>
                    <option value="KEENER_LOGISTICS">Keener Logistics</option>
                    <option value="OAT_IF_BROKERED">OAT if brokered</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={status}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {quoteStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Pickup location" description="Origin address shown on the customer quote." defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pickupAddress">Pickup address</Label>
                  <Input id="pickupAddress" name="pickupAddress" defaultValue={pickupAddress} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupCity">Pickup city</Label>
                  <Input id="pickupCity" name="pickupCity" defaultValue={pickupCity} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupState">Pickup state</Label>
                  <Input id="pickupState" name="pickupState" defaultValue={pickupState} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupZip">Pickup ZIP</Label>
                  <Input id="pickupZip" name="pickupZip" defaultValue={pickupZip} />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Delivery location" description="Destination address shown on the customer quote." defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="deliveryAddress">Delivery address</Label>
                  <Input id="deliveryAddress" name="deliveryAddress" defaultValue={deliveryAddress} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryCity">Delivery city</Label>
                  <Input id="deliveryCity" name="deliveryCity" defaultValue={deliveryCity} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryState">Delivery state</Label>
                  <Input id="deliveryState" name="deliveryState" defaultValue={deliveryState} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryZip">Delivery ZIP</Label>
                  <Input id="deliveryZip" name="deliveryZip" defaultValue={deliveryZip} />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Shipment options" description="Trailer and transport preferences." defaultOpen={false}>
              <div className="space-y-2">
                <Label htmlFor="trailerType">Trailer type</Label>
                <Input id="trailerType" name="trailerType" defaultValue={trailerType} placeholder="e.g. Open, Enclosed" />
                <p className="text-xs text-muted-foreground">Shown on the live quote when provided.</p>
              </div>
            </CollapsibleSection>
          </CardContent>
        </Card>

        <Card className="border-sky-200/50">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>1. Customer quote</CardTitle>
              <QuoteFieldBadge variant="customer-visible" />
            </div>
            <CardDescription>
              What the customer sees and pays on the live quote link — total, deposit, balance, and customer-visible line items.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer total</p>
                <p className="mt-1 text-xl font-bold">{currency(preview.customerTotal)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositDue">Deposit due</Label>
                <Input
                  id="depositDue"
                  name="depositDue"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={depositDue.toString()}
                />
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance due</p>
                <p className="mt-1 text-xl font-bold">{currency(preview.balanceDue)}</p>
              </div>
            </div>
            <QuoteFeeCustomerSection />
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="customerNotes">Customer notes</Label>
              <p className="text-xs text-muted-foreground">Visible on the live quote page.</p>
              <Textarea id="customerNotes" name="customerNotes" defaultValue={customerNotes} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200/60 bg-indigo-50/10">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>2. Carrier / driver pay</CardTitle>
              <QuoteFieldBadge variant="carrier-facing" />
            </div>
            <CardDescription>
              What you may offer or pay the carrier. Not shown on the public customer quote page today. A separate carrier-facing view may come later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuoteFeeInternalSection section="carrier" />
          </CardContent>
        </Card>

        <Card className="border-amber-200/60 bg-amber-50/10">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>3. Internal profit view</CardTitle>
              <QuoteFieldBadge variant="internal-only" />
            </div>
            <CardDescription>
              Broker margin, internal-only costs, and dispatch notes. Never exposed on public customer quote pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuoteFeeInternalSection section="internal" />
            <div className="space-y-2 border-t border-amber-200/60 pt-4">
              <Label htmlFor="internalNotes">Internal notes</Label>
              <p className="text-xs text-muted-foreground">Dispatch-only — never shown to customers.</p>
              <Textarea id="internalNotes" name="internalNotes" defaultValue={internalNotes} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Profit calculator</CardTitle>
            <CardDescription>
              Gross profit = customer total − carrier pay. Margin % = gross profit ÷ customer total.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuoteProfitSummary preview={preview} />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {isDirty ? (
                <span className="font-medium text-amber-800">Unsaved changes</span>
              ) : (
                <span>All changes saved locally</span>
              )}
              <span className="mx-2">·</span>
              <span>Does not update GHL unless you manually sync.</span>
            </div>
            <Button type="submit" className="px-6">
              <Save className="h-4 w-4" /> Save quote
            </Button>
          </div>
        </div>
      </form>
    </QuoteFeeEditorProvider>
  );
}

export function QuoteSidebarTotals({ preview }: { preview: QuoteFormPreview }) {
  return (
    <div className="space-y-3">
      <p className="text-2xl font-bold tracking-tight">{currency(preview.customerTotal)}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">Deposit</p>
          <p className="font-medium">{currency(preview.depositDue)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Balance</p>
          <p className="font-medium">{currency(preview.balanceDue)}</p>
        </div>
      </div>
      <div className="border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Carrier pay</span>
          <span className="font-medium">{currency(preview.carrierPay)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Gross profit</span>
          <span className="font-medium">{currency(preview.grossMargin)}</span>
        </div>
      </div>
    </div>
  );
}
