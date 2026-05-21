import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { QuoteFee } from "@prisma/client";
import { ExternalLink, FileText, RefreshCw, Save, Send, Upload } from "lucide-react";
import { generatePdfAndSyncAction, refreshQuoteFromGhlAction, syncQuoteToGhlAction, updateQuoteAction } from "@/app/actions";
import { QuoteFeeCustomRows } from "@/components/quote-fee-custom-rows";
import { CompanyLogo } from "@/components/company-logo";
import { LiveQuoteLinkField } from "@/components/live-quote-link-field";
import { companyCompactLogoUrl } from "@/lib/company-branding";
import { resolveLiveQuoteUrl } from "@/lib/live-quote-url";
import { markQuoteNotificationsRead } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { calculateFeeTotals, defaultQuoteFees } from "@/lib/quote-fees";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ syncStatus?: string; syncMessage?: string }>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const quote = await prisma.quote.findUnique({
    where: { id: routeParams.id },
    include: {
      customerSnapshot: true,
      company: true,
      fees: true,
      vehicles: true,
      customerMessages: { orderBy: { createdAt: "desc" } },
      ghlSyncLogs: {
        where: { direction: "APP_TO_GHL" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!quote) notFound();

  after(async () => {
    const result = await markQuoteNotificationsRead(quote.id);
    if (result.count > 0) {
      revalidatePath("/");
    }
  });

  const vehicle = quote.vehicles[0];
  const fees = ensureQuoteFees(quote.fees);
  const totals = calculateFeeTotals(fees);
  const latestGhlSync = quote.ghlSyncLogs[0];
  const syncFeedbackMessage = query.syncMessage ? decodeURIComponent(query.syncMessage) : null;
  const liveQuoteUrl = resolveLiveQuoteUrl(quote);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <CompanyLogo
            name={quote.company.name}
            legalName={quote.company.legalName}
            logoUrl={companyCompactLogoUrl(quote.company)}
            variant="compact"
          />
          <div>
            <p className="text-sm font-medium text-muted-foreground">{quote.status}</p>
            <h2 className="text-3xl font-bold tracking-normal">{quote.quoteNumber}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={liveQuoteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Open live quote
            </Link>
          </Button>
          <form action={refreshQuoteFromGhlAction}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <Button type="submit" variant="outline">
              <RefreshCw className="h-4 w-4" /> Refresh from GHL
            </Button>
          </form>
          <Button asChild variant="outline">
            <Link href={`/quotes/${quote.id}/preview`}>
              <FileText className="h-4 w-4" /> Print preview
            </Link>
          </Button>
          <form action={generatePdfAndSyncAction}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <Button type="submit" variant="secondary">
              <Send className="h-4 w-4" /> Generate PDF (optional)
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Quote details</CardTitle>
            <CardDescription>Imported GHL lead data is editable on the quote snapshot without changing the original GHL contact.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateQuoteAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="quoteId" value={quote.id} />
              <div className="space-y-2">
                <Label htmlFor="quoteMode">Quote mode</Label>
                <select id="quoteMode" name="quoteMode" defaultValue={quote.quoteMode} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="OAT_DIRECT">OAT Direct</option>
                  <option value="KEENER_LOGISTICS">Keener Logistics</option>
                  <option value="OAT_IF_BROKERED">OAT if brokered</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" defaultValue={quote.status} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="IMPORTED_FROM_GHL">Imported from GHL</option>
                  <option value="READY_TO_SEND">Ready to send</option>
                  <option value="SENT">Sent</option>
                  <option value="VIEWED">Viewed</option>
                  <option value="QUESTION">Question</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="DECLINED">Declined</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupCity">Pickup city</Label>
                <Input id="pickupCity" name="pickupCity" defaultValue={quote.pickupCity ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupState">Pickup state</Label>
                <Input id="pickupState" name="pickupState" defaultValue={quote.pickupState ?? ""} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pickupAddress">Pickup address</Label>
                <Input id="pickupAddress" name="pickupAddress" defaultValue={quote.pickupAddress ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupZip">Pickup ZIP</Label>
                <Input id="pickupZip" name="pickupZip" defaultValue={quote.pickupZip ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trailerType">Trailer type</Label>
                <Input id="trailerType" name="trailerType" defaultValue={quote.trailerType ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryCity">Delivery city</Label>
                <Input id="deliveryCity" name="deliveryCity" defaultValue={quote.deliveryCity ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryState">Delivery state</Label>
                <Input id="deliveryState" name="deliveryState" defaultValue={quote.deliveryState ?? ""} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="deliveryAddress">Delivery address</Label>
                <Input id="deliveryAddress" name="deliveryAddress" defaultValue={quote.deliveryAddress ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryZip">Delivery ZIP</Label>
                <Input id="deliveryZip" name="deliveryZip" defaultValue={quote.deliveryZip ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Customer total</Label>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm font-semibold">{currency(totals.customerTotal)}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositDue">Deposit due</Label>
                <Input id="depositDue" name="depositDue" type="number" min="0" step="0.01" defaultValue={quote.depositDue.toString()} />
              </div>
              <div className="space-y-2">
                <Label>Internal gross margin</Label>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm font-semibold">
                  {currency(totals.grossMargin)} {totals.marginPercentage == null ? "" : `(${totals.marginPercentage.toFixed(2)}%)`}
                </div>
              </div>
              <div className="space-y-3 md:col-span-2">
                <div>
                  <Label>Selectable fees</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Customer-facing enabled fees build the customer total. Internal-only fees stay off the live quote page and optional PDF copy.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="hidden rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground xl:grid xl:grid-cols-[72px_180px_1fr_130px_110px_110px_1fr_90px]">
                    <span>Enabled</span>
                    <span>Type</span>
                    <span>Label</span>
                    <span>Amount</span>
                    <span>PDF</span>
                    <span>Internal</span>
                    <span>Internal note</span>
                    <span>Order</span>
                  </div>
                  {fees.map((fee, index) => {
                    const rowId = fee.id ?? `default-${fee.feeType}`;
                    return (
                      <div key={rowId} className="grid gap-2 rounded-md border p-3 xl:grid-cols-[72px_180px_1fr_130px_110px_110px_1fr_90px]">
                        <input type="hidden" name="feeRowId" value={rowId} />
                        <input type="hidden" name={`feeType_${rowId}`} value={fee.feeType} />
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="feeEnabled" value={rowId} defaultChecked={fee.isEnabled} className="h-4 w-4" /> Enable
                        </label>
                        <div className="text-sm font-medium">{fee.feeType.replaceAll("_", " ")}</div>
                        <Input name={`feeLabel_${rowId}`} defaultValue={fee.label} />
                        <Input name={`feeAmount_${rowId}`} type="number" step="0.01" defaultValue={fee.amount.toString()} />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="feeShowOnPdf"
                            value={rowId}
                            defaultChecked={fee.showOnPdf}
                            className="h-4 w-4"
                          />{" "}
                          PDF
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="feeInternalOnly"
                            value={rowId}
                            defaultChecked={fee.isInternalOnly}
                            className="h-4 w-4"
                          />{" "}
                          Internal
                        </label>
                        <Textarea name={`feeInternalNote_${rowId}`} defaultValue={fee.internalNote ?? ""} className="min-h-10" />
                        <Input name={`feeSortOrder_${rowId}`} type="number" defaultValue={fee.sortOrder || index + 1} />
                      </div>
                    );
                  })}
                  <QuoteFeeCustomRows startIndex={fees.length + 1} />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerNotes">Customer notes</Label>
                <Textarea id="customerNotes" name="customerNotes" defaultValue={quote.customerNotes ?? ""} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="internalNotes">Internal notes</Label>
                <Textarea id="internalNotes" name="internalNotes" defaultValue={quote.internalNotes ?? ""} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">
                  <Save className="h-4 w-4" /> Save quote
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer delivery</CardTitle>
              <CardDescription>Send the live quote link to the customer. No PDF is required.</CardDescription>
            </CardHeader>
            <CardContent>
              <LiveQuoteLinkField url={liveQuoteUrl} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Imported snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{quote.customerSnapshot.name}</p>
              <p>{quote.customerSnapshot.email ?? "No email"}</p>
              <p>{quote.customerSnapshot.phone ?? "No phone"}</p>
              <p>
                {vehicle?.year} {vehicle?.make} {vehicle?.model}
              </p>
              <p className="break-all text-muted-foreground">{quote.ghlOpportunityId}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer activity</CardTitle>
              <CardDescription>Responses submitted from the public quote link.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {quote.lastCustomerActionAt && (
                <p className="text-muted-foreground">
                  Last customer action: {quote.lastCustomerActionAt.toLocaleString()}
                </p>
              )}
              {quote.status === "ACCEPTED" && (
                <div className="rounded-md border bg-secondary/10 p-3">
                  <p className="font-medium text-secondary">Accepted</p>
                  {quote.customerSignature && <p>Signature: {quote.customerSignature}</p>}
                  {quote.acceptedAt && <p className="text-muted-foreground">{quote.acceptedAt.toLocaleString()}</p>}
                </div>
              )}
              {quote.status === "DECLINED" && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                  <p className="font-medium text-destructive">Declined</p>
                  {quote.declineReason && <p className="mt-1 whitespace-pre-wrap">{quote.declineReason}</p>}
                  {quote.declinedAt && <p className="mt-1 text-muted-foreground">{quote.declinedAt.toLocaleString()}</p>}
                </div>
              )}
              {quote.customerMessages.length > 0 ? (
                <div className="space-y-3">
                  <p className="font-medium">Customer questions</p>
                  {quote.customerMessages.map((entry) => (
                    <div key={entry.id} className="rounded-md border p-3">
                      <p className="font-medium">{entry.customerName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{entry.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{entry.createdAt.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                !quote.lastCustomerActionAt && <p className="text-muted-foreground">No customer responses yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>GHL Sync</CardTitle>
              <CardDescription>Quote results and customer actions pushed back to GoHighLevel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {syncFeedbackMessage && (
                <div className="rounded-md border bg-muted/50 p-3">
                  <p className="font-medium">{query.syncStatus ?? "SYNC"}</p>
                  <p className="mt-1 text-muted-foreground">{syncFeedbackMessage}</p>
                </div>
              )}
              {latestGhlSync ? (
                <div className="space-y-2">
                  <p>
                    <span className="text-muted-foreground">Status:</span> {latestGhlSync.status}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Direction:</span> {latestGhlSync.direction}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Last sync:</span> {latestGhlSync.createdAt.toLocaleString()}
                  </p>
                  {latestGhlSync.errorMessage && (
                    <p className="whitespace-pre-wrap text-destructive">{latestGhlSync.errorMessage}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No sync-back attempts yet.</p>
              )}
              <form action={syncQuoteToGhlAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <Button type="submit" variant="outline" className="w-full">
                  <Upload className="h-4 w-4" /> Sync to GHL
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Quote total</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold tracking-normal">{currency(quote.customerTotal.toString())}</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Carrier pay: {currency(quote.internalEstimatedCarrierPay?.toString() ?? 0)}</p>
                <p>Gross margin: {currency(quote.internalGrossMargin?.toString() ?? 0)}</p>
              </div>
              {quote.quotePdfUrl ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={quote.quotePdfUrl} target="_blank" rel="noopener noreferrer">
                    Download PDF copy (optional)
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">No PDF generated yet. The live quote link is ready to send.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ensureQuoteFees(fees: QuoteFee[]) {
  const byType = new Map(fees.map((fee) => [fee.feeType, fee]));
  const defaults = defaultQuoteFees.filter((fee) => fee.feeType !== "CUSTOM").map((defaultFee) => {
    const existing = byType.get(defaultFee.feeType);
    return {
      id: existing?.id,
      feeType: defaultFee.feeType,
      label: existing?.label ?? defaultFee.label,
      amount: existing?.amount ?? 0,
      isEnabled: existing?.isEnabled ?? false,
      showOnPdf: existing?.showOnPdf ?? defaultFee.showOnPdf,
      isInternalOnly: existing?.isInternalOnly ?? defaultFee.isInternalOnly,
      internalNote: existing?.internalNote ?? "",
      sortOrder: existing?.sortOrder ?? defaultFee.sortOrder,
    };
  });
  const existingCustomFees = fees
    .filter((fee) => fee.feeType === "CUSTOM")
    .map((fee) => ({
      id: fee.id,
      feeType: fee.feeType,
      label: fee.label,
      amount: fee.amount,
      isEnabled: fee.isEnabled,
      showOnPdf: fee.showOnPdf,
      isInternalOnly: fee.isInternalOnly,
      internalNote: fee.internalNote,
      sortOrder: fee.sortOrder,
    }));
  const customFees = existingCustomFees.length
    ? existingCustomFees
    : defaultQuoteFees
        .filter((fee) => fee.feeType === "CUSTOM")
        .map((fee) => ({
          id: undefined,
          feeType: fee.feeType,
          label: fee.label,
          amount: 0,
          isEnabled: false,
          showOnPdf: fee.showOnPdf,
          isInternalOnly: fee.isInternalOnly,
          internalNote: "",
          sortOrder: fee.sortOrder,
        }));
  return [...defaults, ...customFees].sort((a, b) => a.sortOrder - b.sortOrder);
}
