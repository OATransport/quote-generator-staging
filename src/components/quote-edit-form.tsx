"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { updateQuoteAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/collapsible-section";
import { QuoteBreakdownProvider } from "@/components/quote-breakdown-section";
import { QuoteLivePreview } from "@/components/quote-live-preview";
import { QuoteModelSelector } from "@/components/quote-model-selector";
import { QuotePricingWorkspace } from "@/components/quote-pricing-workspace";
import { ZipAutofillGroup } from "@/components/zip-autofill-group";
import { buildPreviewFromFormElement, type QuoteFeeRowData, type QuoteFormPreview } from "@/lib/quote-form-preview";
import { quoteStatusOptions } from "@/lib/form-parsing";
import { getQuoteModelConfig, resolveDefaultQuoteMode } from "@/lib/quote-model";
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
  return <QuoteSidebarTotals preview={preview} quoteMode={preview.quoteMode} />;
}

type QuotePreviewContextProps = {
  customerName: string;
  liveQuoteUrl: string;
  ghlOpportunityId: string | null;
  syncStatusLabel: string;
  syncFeedbackMessage?: string | null;
  syncFeedbackStatus?: string | null;
};

type QuoteEditFormProps = {
  quoteId: string;
  quoteMode: string;
  companyName: string;
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
  pickupDateWindow: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleType: string;
  vehicleCondition: string;
  vehicleNotes: string;
  breakdownFees: QuoteFeeRowData[];
};

export function QuoteEditForm({
  quoteId,
  quoteMode,
  companyName,
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
  pickupDateWindow,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  vehicleType,
  vehicleCondition,
  vehicleNotes,
  breakdownFees,
}: QuoteEditFormProps) {
  const { preview, setPreview } = usePreviewContext();
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    resolveDefaultQuoteMode({ quoteMode: quoteMode as "OAT_DIRECT" | "OAT_IF_BROKERED" | "KEENER_LOGISTICS", companyName }),
  );

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

  const handleModelChange = (mode: string) => {
    setSelectedModel(mode as typeof selectedModel);
    setIsDirty(true);
    requestAnimationFrame(refreshPreview);
  };

  return (
    <QuoteBreakdownProvider initialFees={breakdownFees} onChange={refreshPreview}>
      <form ref={formRef} action={updateQuoteAction} className="space-y-6">
        <input type="hidden" name="quoteId" value={quoteId} />

        <Card className="border-primary/20 shadow-md ring-1 ring-primary/10">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>Guided quote builder</CardTitle>
            <CardDescription>Start with the quote model, then route, vehicle, and pricing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <QuoteModelSelector value={selectedModel} onChange={handleModelChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route & shipment</CardTitle>
            <CardDescription>Pickup and delivery details shown on the customer quote.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CollapsibleSection title="Pickup location" defaultOpen>
              <ZipAutofillGroup
                prefix="pickup"
                title="Pickup"
                address={pickupAddress}
                city={pickupCity}
                state={pickupState}
                zip={pickupZip}
                onFieldChange={refreshPreview}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Delivery location" defaultOpen>
              <ZipAutofillGroup
                prefix="delivery"
                title="Delivery"
                address={deliveryAddress}
                city={deliveryCity}
                state={deliveryState}
                zip={deliveryZip}
                onFieldChange={refreshPreview}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Vehicle details" description="Editable vehicle information for this quote." defaultOpen>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="vehicleYear">Vehicle year</Label>
                  <Input id="vehicleYear" name="vehicleYear" defaultValue={vehicleYear} placeholder="e.g. 2021" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleMake">Vehicle make</Label>
                  <Input id="vehicleMake" name="vehicleMake" defaultValue={vehicleMake} placeholder="e.g. Toyota" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleModel">Vehicle model</Label>
                  <Input id="vehicleModel" name="vehicleModel" defaultValue={vehicleModel} placeholder="e.g. Camry" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleType">Vehicle type</Label>
                  <Input id="vehicleType" name="vehicleType" defaultValue={vehicleType} placeholder="e.g. Sedan, SUV" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleCondition">Running status</Label>
                  <Input id="vehicleCondition" name="vehicleCondition" defaultValue={vehicleCondition} placeholder="Running / Not running" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trailerType">Transport type</Label>
                  <Input id="trailerType" name="trailerType" defaultValue={transportType} placeholder="e.g. Open, Enclosed" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pickupDateWindow">Pickup date / window</Label>
                  <Input id="pickupDateWindow" name="pickupDateWindow" defaultValue={pickupDateWindow} placeholder="e.g. May 24 or ASAP" />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="vehicleNotes">Shipment notes</Label>
                  <Textarea id="vehicleNotes" name="vehicleNotes" defaultValue={vehicleNotes} placeholder="Vehicle or shipment notes visible internally" rows={3} />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Workflow status" description="Internal quote status.">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" defaultValue={status} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {quoteStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </CollapsibleSection>
          </CardContent>
        </Card>

        <QuotePricingWorkspace
          quoteMode={selectedModel}
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

export function QuoteSidebarTotals({ preview, quoteMode }: { preview: QuoteFormPreview; quoteMode: string }) {
  const config = getQuoteModelConfig(preview.quoteMode || quoteMode);

  return (
    <div className="space-y-3">
      <p className="text-2xl font-bold tracking-tight">{currency(preview.customerTotal)}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">Deposit</p>
          <p className="font-medium">{currency(preview.depositDue)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Balance on delivery</p>
          <p className="font-medium">{currency(preview.balanceDue)}</p>
        </div>
      </div>
      <div className="border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Model</span>
          <span className="font-medium text-right text-xs">{config.shortTitle}</span>
        </div>
      </div>
    </div>
  );
}
