import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { QuoteFee } from "@prisma/client";
import { ExternalLink, FileText, MapPin, RefreshCw, Send, Truck, Upload } from "lucide-react";
import { generatePdfAndSyncAction, refreshQuoteFromGhlAction, syncQuoteToGhlAction } from "@/app/actions";
import { ArchiveQuoteButton } from "@/components/archive-quote-button";
import { CopyLiveQuoteButton } from "@/components/copy-live-quote-button";
import { CompanyLogo } from "@/components/company-logo";
import { LiveQuoteLinkField } from "@/components/live-quote-link-field";
import {
  QuoteEditForm,
  QuoteEditWorkspace,
  QuoteLivePreviewPanel,
  QuoteSidebarTotalsLive,
} from "@/components/quote-edit-form";
import { QuoteFieldBadge } from "@/components/quote-field-badge";
import { companyCompactLogoUrl } from "@/lib/company-branding";
import { buildInitialPreview, type QuoteFeeRowData } from "@/lib/quote-form-preview";
import { resolveLiveQuoteUrl } from "@/lib/live-quote-url";
import { markQuoteNotificationsRead } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { calculateFeeTotals, defaultQuoteFees } from "@/lib/quote-fees";
import { formatRouteSummaryShort } from "@/lib/route-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ syncStatus?: string; syncMessage?: string; saved?: string; saveError?: string }>;
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
  const fees = ensureQuoteFees(quote.fees, Number(quote.customerTotal));
  const latestGhlSync = quote.ghlSyncLogs[0];
  const syncFeedbackMessage = query.syncMessage ? decodeURIComponent(query.syncMessage) : null;
  const liveQuoteUrl = resolveLiveQuoteUrl(quote);
  const routeSummary = formatRouteSummaryShort(quote.pickupCity, quote.pickupState, quote.deliveryCity, quote.deliveryState);
  const vehicleSummary = formatVehicleSummary(vehicle);
  const isArchived = Boolean(quote.archivedAt);

  const initialPreview = buildInitialPreview({
    fees,
    customerTotal: Number(quote.customerTotal),
    depositDue: Number(quote.depositDue),
    customerNotes: quote.customerNotes ?? "",
    internalNotes: quote.internalNotes ?? "",
    routeSummary,
  });

  const previewContext = {
    customerName: quote.customerSnapshot.name,
    vehicleSummary,
    liveQuoteUrl,
    routeSummary,
    ghlOpportunityId: quote.ghlOpportunityId,
    syncStatusLabel: latestGhlSync
      ? `${latestGhlSync.status} · ${latestGhlSync.createdAt.toLocaleString()}`
      : "No sync-back attempts",
    syncFeedbackMessage,
    syncFeedbackStatus: query.syncStatus ?? null,
  };

  const saveErrorMessage =
    query.saveError === "save-failed"
      ? "Could not save this quote. Check pricing values and try again."
      : query.saveError
        ? "Could not save this quote."
        : null;
  const saveSuccess = query.saved === "1";

  return (
    <QuoteEditWorkspace initialPreview={initialPreview}>
      <div className="min-h-screen bg-muted/30">
        {(saveSuccess || saveErrorMessage) && (
          <div className="border-b bg-background px-6 py-3 lg:px-8">
            <div className="mx-auto max-w-[1400px]">
              {saveSuccess ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Quote saved successfully.
                </div>
              ) : null}
              {saveErrorMessage ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {saveErrorMessage}
                </div>
              ) : null}
            </div>
          </div>
        )}
        <div className="border-b bg-background">
          <div className="mx-auto max-w-[1400px] space-y-5 px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <CompanyLogo
                  name={quote.company.name}
                  legalName={quote.company.legalName}
                  logoUrl={companyCompactLogoUrl(quote.company)}
                  variant="compact"
                />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">{quote.quoteNumber}</h1>
                    <CompanyBadge name={quote.company.name} />
                    <StatusBadge status={quote.status} />
                    {isArchived ? <ArchivedBadge archivedAt={quote.archivedAt!} /> : null}
                  </div>
                  <p className="text-lg font-medium">{quote.customerSnapshot.name}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {routeSummary}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      {vehicleSummary}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                <CopyLiveQuoteButton url={liveQuoteUrl} />
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={liveQuoteUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Open live quote
                    </Link>
                  </Button>
                  <form action={refreshQuoteFromGhlAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <Button type="submit" variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4" /> Refresh from GHL
                    </Button>
                  </form>
                  <form action={generatePdfAndSyncAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      <Send className="h-4 w-4" /> Generate PDF
                    </Button>
                  </form>
                  <form action={syncQuoteToGhlAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <Button type="submit" variant="outline" size="sm">
                      <Upload className="h-4 w-4" /> Sync to GHL
                    </Button>
                  </form>
                  {!isArchived ? <ArchiveQuoteButton quoteId={quote.id} /> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-[1400px] gap-6 px-6 py-6 lg:grid-cols-[1fr_320px] lg:px-8">
          <div className="space-y-6">
            <QuoteLivePreviewPanel quoteMode={quote.quoteMode} previewContext={previewContext} />
            <QuoteEditForm
              quoteId={quote.id}
              quoteMode={quote.quoteMode}
              status={quote.status}
              customerTotal={Number(quote.customerTotal)}
              depositDue={Number(quote.depositDue)}
              customerNotes={quote.customerNotes ?? ""}
              internalNotes={quote.internalNotes ?? ""}
              pickupAddress={quote.pickupAddress ?? ""}
              pickupCity={quote.pickupCity ?? ""}
              pickupState={quote.pickupState ?? ""}
              pickupZip={quote.pickupZip ?? ""}
              deliveryAddress={quote.deliveryAddress ?? ""}
              deliveryCity={quote.deliveryCity ?? ""}
              deliveryState={quote.deliveryState ?? ""}
              deliveryZip={quote.deliveryZip ?? ""}
              trailerType={quote.trailerType ?? ""}
              fees={fees}
            />
          </div>

          <aside className="space-y-4">
            <SidebarCard title="Customer delivery" description="Primary delivery method — no PDF required.">
              <LiveQuoteLinkField url={liveQuoteUrl} inputId="liveQuoteLinkSidebar" />
              {quote.quotePdfUrl ? (
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link href={quote.quotePdfUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" /> Download PDF (optional)
                  </Link>
                </Button>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No PDF generated. Live link is ready to send.</p>
              )}
            </SidebarCard>

            <SidebarCard title="Quote totals">
              <QuoteSidebarTotalsLive />
            </SidebarCard>

            <SidebarCard title="Imported snapshot">
              <div className="space-y-1 text-sm">
                <p className="font-medium">{quote.customerSnapshot.name}</p>
                <p className="text-muted-foreground">{quote.customerSnapshot.email ?? "No email"}</p>
                <p className="text-muted-foreground">{quote.customerSnapshot.phone ?? "No phone"}</p>
                <p>{vehicleSummary}</p>
                <p className="break-all text-xs text-muted-foreground">{quote.ghlOpportunityId}</p>
                <QuoteFieldBadge variant="synced-from-ghl" className="mt-2" />
              </div>
            </SidebarCard>

            <SidebarCard title="Customer activity" description="Responses from the public quote link.">
              {quote.lastCustomerActionAt && (
                <p className="text-xs text-muted-foreground">Last action: {quote.lastCustomerActionAt.toLocaleString()}</p>
              )}
              {quote.status === "ACCEPTED" && (
                <div className="rounded-md border bg-secondary/10 p-3 text-sm">
                  <p className="font-medium text-secondary">Accepted</p>
                  {quote.customerSignature && <p>Signature: {quote.customerSignature}</p>}
                  {quote.acceptedAt && <p className="text-muted-foreground">{quote.acceptedAt.toLocaleString()}</p>}
                </div>
              )}
              {quote.status === "DECLINED" && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">Declined</p>
                  {quote.declineReason && <p className="mt-1 whitespace-pre-wrap">{quote.declineReason}</p>}
                </div>
              )}
              {quote.customerMessages.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {quote.customerMessages.map((entry) => (
                    <div key={entry.id} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{entry.customerName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{entry.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.createdAt.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                !quote.lastCustomerActionAt && <p className="text-sm text-muted-foreground">No responses yet.</p>
              )}
            </SidebarCard>

            <SidebarCard title="GHL sync" description="Quote results pushed back to GoHighLevel.">
              {latestGhlSync ? (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Status:</span> {latestGhlSync.status}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Last sync:</span> {latestGhlSync.createdAt.toLocaleString()}
                  </p>
                  {latestGhlSync.errorMessage && (
                    <p className="whitespace-pre-wrap text-destructive">{latestGhlSync.errorMessage}</p>
                  )}
                  <QuoteFieldBadge variant="synced-to-ghl" className="mt-2" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sync-back attempts yet.</p>
              )}
              <form action={syncQuoteToGhlAction} className="mt-3">
                <input type="hidden" name="quoteId" value={quote.id} />
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  <Upload className="h-4 w-4" /> Sync to GHL
                </Button>
              </form>
            </SidebarCard>
          </aside>
        </div>
      </div>
    </QuoteEditWorkspace>
  );
}

function ensureQuoteFees(fees: QuoteFee[], customerTotal = 0): QuoteFeeRowData[] {
  const byType = new Map(fees.map((fee) => [fee.feeType, fee]));
  const defaults = defaultQuoteFees.filter((fee) => fee.feeType !== "CUSTOM").map((defaultFee) => {
    const existing = byType.get(defaultFee.feeType);
    return {
      id: existing?.id,
      feeType: defaultFee.feeType,
      label: existing?.label ?? defaultFee.label,
      amount: Number(existing?.amount ?? 0),
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
      amount: Number(fee.amount),
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
  const merged = [...defaults, ...customFees].sort((a, b) => a.sortOrder - b.sortOrder);
  const enabledCustomerTotal = calculateFeeTotals(merged).customerTotal;

  if (customerTotal > 0 && enabledCustomerTotal <= 0) {
    const brokerFee = merged.find((fee) => fee.feeType === "BROKER_FEE" && !fee.isInternalOnly);
    if (brokerFee) {
      brokerFee.isEnabled = true;
      brokerFee.amount = customerTotal;
      brokerFee.showOnPdf = true;
    }
  }

  return merged;
}

function formatVehicleSummary(
  vehicle: { year?: string | number | null; make?: string | null; model?: string | null; type?: string | null } | undefined,
) {
  const parts = [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.type].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vehicle not specified";
}

function CompanyBadge({ name }: { name: string }) {
  const isKeener = name.toLowerCase().includes("keener");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        isKeener ? "bg-slate-800 text-white" : "bg-sky-700 text-white",
      )}
    >
      {isKeener ? "Keener Logistics" : "Organized Auto Transport"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    IMPORTED_FROM_GHL: "bg-violet-100 text-violet-800",
    READY_TO_SEND: "bg-blue-100 text-blue-800",
    SENT: "bg-indigo-100 text-indigo-800",
    VIEWED: "bg-cyan-100 text-cyan-800",
    QUESTION: "bg-amber-100 text-amber-900",
    ACCEPTED: "bg-emerald-100 text-emerald-800",
    DECLINED: "bg-red-100 text-red-800",
    CANCELLED: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status] ?? "bg-muted text-muted-foreground")}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function ArchivedBadge({ archivedAt }: { archivedAt: Date }) {
  return (
    <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-800">
      Archived · {archivedAt.toLocaleDateString()}
    </span>
  );
}

function SidebarCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
