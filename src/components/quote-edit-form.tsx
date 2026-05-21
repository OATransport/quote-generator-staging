"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { updateQuoteAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/collapsible-section";
import { QuoteBreakdownProvider } from "@/components/quote-breakdown-section";
import { QuoteLivePreview } from "@/components/quote-live-preview";
import { QuotePricingWorkspace } from "@/components/quote-pricing-workspace";
import { buildPreviewFromFormElement, type QuoteFeeRowData, type QuoteFormPreview } from "@/lib/quote-form-preview";
import { quoteStatusOptions } from "@/lib/form-parsing";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  customerTotal: number;
  depositDue: number;
  carrierPay: number;
  showItemizedBreakdown: boolean;
  customerNotes: string;
  internalNotes: string;
  carrierNotes: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  transportType: string;
  pickupDate: string;
  breakdownFees: QuoteFeeRowData[];
};

export function QuoteEditForm({
  quoteId,
  quoteMode,
  status,
  customerTotal,
  depositDue,
  carrierPay,
  showItemizedBreakdown,
  customerNotes,
  internalNotes,
  carrierNotes,
  pickupAddress,
  pickupCity,
  pickupState,
  pickupZip,
  deliveryAddress,
  deliveryCity,
  deliveryState,
  deliveryZip,
  transportType,
  pickupDate,
  breakdownFees,
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
    <QuoteBreakdownProvider initialFees={breakdownFees} onChange={refreshPreview}>
      <form ref={formRef} action={updateQuoteAction} className="space-y-6">
        <input type="hidden" name="quoteId" value={quoteId} />

        <Card>
          <CardHeader>
            <CardTitle>Shipment details</CardTitle>
            <CardDescription>Route, vehicle, and transport details shown on the customer quote when provided.</CardDescription>
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

            <CollapsibleSection title="Pickup location" defaultOpen>
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

            <CollapsibleSection title="Delivery location" defaultOpen>
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

            <CollapsibleSection title="Vehicle & transport" defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trailerType">Transport type</Label>
                  <Input id="trailerType" name="trailerType" defaultValue={transportType} placeholder="e.g. Open, Enclosed" />
                  <p className="text-xs text-muted-foreground">Imported from Keener when available. OAT can enter manually.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupDate">Pickup date / window</Label>
                  <Input id="pickupDate" name="pickupDate" defaultValue={pickupDate} placeholder="e.g. May 24 or ASAP" />
                </div>
              </div>
            </CollapsibleSection>
          </CardContent>
        </Card>

        <QuotePricingWorkspace
          preview={preview}
          customerTotal={customerTotal}
          depositDue={depositDue}
          carrierPay={carrierPay}
          showItemizedBreakdown={showItemizedBreakdown}
          customerNotes={customerNotes}
          internalNotes={internalNotes}
          carrierNotes={carrierNotes}
        />

        <div className="sticky bottom-0 z-10 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {isDirty ? <span className="font-medium text-amber-800">Unsaved changes</span> : <span>All changes saved locally</span>}
              <span className="mx-2">·</span>
              <span>Does not update GHL unless you manually sync.</span>
            </div>
            <Button type="submit" className="px-6">
              <Save className="h-4 w-4" /> Save quote
            </Button>
          </div>
        </div>
      </form>
    </QuoteBreakdownProvider>
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
          <span className="text-muted-foreground">Broker fee</span>
          <span className="font-medium">{currency(preview.grossMargin)}</span>
        </div>
      </div>
    </div>
  );
}
