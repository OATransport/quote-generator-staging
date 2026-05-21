import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle, HelpCircle, MapPin, Truck, XCircle } from "lucide-react";
import { acceptQuoteAction, askQuoteQuestionAction, declineQuoteAction } from "@/app/actions";
import { CompanyLogo } from "@/components/company-logo";
import { companyHeaderLogoUrl } from "@/lib/company-branding";
import { prisma } from "@/lib/prisma";
import { currency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  "missing-signature": "Please type your full name to accept the quote.",
  "terms-required": "Please agree to the quote terms before accepting.",
  "missing-decline-reason": "Please tell us why you are declining the quote.",
  "missing-name": "Please enter your name.",
  "missing-question": "Please enter your question.",
  "already-accepted": "This quote has already been accepted.",
  "already-declined": "This quote has already been declined.",
};

export default async function AcceptQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ accepted?: string; declined?: string; question?: string; error?: string }>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const quote = await prisma.quote.findUnique({
    where: { secureAccessToken: routeParams.token },
    include: { company: true, customerSnapshot: true, vehicles: true, fees: { where: { isEnabled: true, isInternalOnly: false } } },
  });
  if (!quote) notFound();

  const vehicle = quote.vehicles[0];
  const isAccepted = quote.status === "ACCEPTED" || query.accepted === "1";
  const isDeclined = quote.status === "DECLINED" || query.declined === "1";
  const questionSubmitted = query.question === "1";
  const errorMessage = query.error ? errorMessages[query.error] ?? "Something went wrong. Please try again." : undefined;
  const pickupLocation = formatLocation(quote.pickupAddress, quote.pickupCity, quote.pickupState, quote.pickupZip);
  const deliveryLocation = formatLocation(quote.deliveryAddress, quote.deliveryCity, quote.deliveryState, quote.deliveryZip);
  const vehicleInfo = [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.type].filter(Boolean).join(" ") || "Not specified";
  const customerFees = quote.fees.filter((fee) => fee.showOnPdf || fee.feeType !== "DISCOUNT");
  const isKeener = quote.company.name.toLowerCase().includes("keener");

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 to-muted/20 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className={cn("px-6 py-5 text-white", isKeener ? "bg-slate-900" : "bg-sky-800")}>
            <div className="brightness-0 invert">
              <CompanyLogo
                name={quote.company.name}
                legalName={quote.company.legalName}
                logoUrl={companyHeaderLogoUrl(quote.company)}
                variant="header"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm/6 text-white/80">Transportation quote</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{quote.quoteNumber}</h1>
              </div>
              <StatusPill status={quote.status} accepted={isAccepted} declined={isDeclined} />
            </div>
          </div>

          <CardContent className="space-y-6 p-6">
            {errorMessage && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            {isAccepted && (
              <AlertBanner tone="success" icon={CheckCircle} title="Quote accepted">
                Thank you{quote.customerSignature ? `, ${quote.customerSignature}` : ""}. {quote.company.name} has been notified and will follow up on next steps.
              </AlertBanner>
            )}

            {isDeclined && (
              <AlertBanner tone="danger" icon={XCircle} title="Quote declined">
                Your response has been recorded. {quote.company.name} has been notified.
              </AlertBanner>
            )}

            {questionSubmitted && (
              <AlertBanner tone="info" icon={HelpCircle} title="Question submitted">
                {quote.company.name} will follow up with you soon.
              </AlertBanner>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard icon={MapPin} title="Pickup" value={pickupLocation} />
              <InfoCard icon={MapPin} title="Delivery" value={deliveryLocation} />
            </div>

            <Card className="border-dashed bg-muted/20 shadow-none">
              <CardContent className="flex flex-col items-center gap-3 p-5 sm:flex-row sm:justify-between">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route</p>
                  <p className="mt-1 text-sm font-medium">{pickupLocation}</p>
                </div>
                <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
                <div className="text-center sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:invisible">Route</p>
                  <p className="mt-1 text-sm font-medium">{deliveryLocation}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Vehicle & shipment</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <Detail label="Vehicle" value={vehicleInfo} />
                <Detail label="Customer" value={quote.customerSnapshot.name} />
                {quote.trailerType ? <Detail label="Trailer type" value={quote.trailerType} /> : null}
                {vehicle?.condition ? <Detail label="Condition" value={vehicle.condition} /> : null}
              </CardContent>
            </Card>

            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pricing summary</CardTitle>
                <CardDescription>Review your quote total, deposit, and remaining balance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <PriceTile label="Quote total" value={currency(quote.customerTotal.toString())} emphasis />
                  <PriceTile label="Deposit due" value={currency(quote.depositDue.toString())} />
                  <PriceTile label="Balance due" value={currency(quote.balanceDue.toString())} />
                </div>
                {customerFees.length > 0 ? (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included items</p>
                    {customerFees.map((fee) => (
                      <div key={fee.id} className="flex justify-between text-sm">
                        <span>{fee.label}</span>
                        <span className="font-medium">{currency(fee.amount.toString())}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {quote.customerNotes ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Notes from {quote.company.name}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{quote.customerNotes}</p>
              </div>
            ) : null}

            {quote.quotePdfUrl ? (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={quote.quotePdfUrl} target="_blank" rel="noopener noreferrer">
                  Download PDF copy (optional)
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {!isAccepted && !isDeclined && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Accept this quote</CardTitle>
              <CardDescription>Type your name and agree to the terms to approve this transportation quote.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={acceptQuoteAction} className="space-y-4">
                <input type="hidden" name="token" value={routeParams.token} />
                <div className="space-y-2">
                  <Label htmlFor="customerSignature">Your full name (signature)</Label>
                  <Input
                    id="customerSignature"
                    name="customerSignature"
                    defaultValue={quote.customerSnapshot.name}
                    placeholder="Type your full name"
                    required
                  />
                </div>
                {quote.company.defaultTerms && (
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                    {quote.company.defaultTerms}
                  </div>
                )}
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="agreeTerms" className="mt-1 h-4 w-4" required />
                  <span>I agree to the quote terms and authorize {quote.company.name} to proceed based on this quote.</span>
                </label>
                <Button type="submit" className="h-11 w-full text-base">
                  Accept quote
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!isAccepted && !isDeclined && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Decline quote</CardTitle>
              <CardDescription>Optional — tell us why this quote does not work for you.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={declineQuoteAction} className="space-y-4">
                <input type="hidden" name="token" value={routeParams.token} />
                <div className="space-y-2">
                  <Label htmlFor="declineReason">Reason for declining</Label>
                  <Textarea id="declineReason" name="declineReason" placeholder="Tell us why you are declining this quote" required />
                </div>
                <Button type="submit" variant="outline" className="w-full">
                  Decline quote
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ask a question</CardTitle>
            <CardDescription>Send a message to {quote.company.name} about this quote.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={askQuoteQuestionAction} className="space-y-4">
              <input type="hidden" name="token" value={routeParams.token} />
              <div className="space-y-2">
                <Label htmlFor="customerName">Your name</Label>
                <Input id="customerName" name="customerName" defaultValue={quote.customerSnapshot.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Your question</Label>
                <Textarea id="message" name="message" placeholder="What would you like to know?" required />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                Send question
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Questions? Contact {quote.company.name}
          {quote.company.phone ? ` at ${quote.company.phone}` : ""}.
        </p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, title, value }: { icon: typeof MapPin; title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-sm font-medium">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PriceTile({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-4", emphasis ? "border-primary/30 bg-primary/5" : "bg-muted/20")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-bold", emphasis ? "text-2xl text-primary" : "text-xl")}>{value}</p>
    </div>
  );
}

function StatusPill({ status, accepted, declined }: { status: string; accepted: boolean; declined: boolean }) {
  const label = accepted ? "Accepted" : declined ? "Declined" : status.replaceAll("_", " ");
  const styles = accepted
    ? "bg-emerald-500/20 text-emerald-100"
    : declined
      ? "bg-red-500/20 text-red-100"
      : "bg-white/15 text-white";
  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", styles)}>{label}</span>;
}

function AlertBanner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "success" | "danger" | "info";
  icon: typeof CheckCircle;
  title: string;
  children: ReactNode;
}) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
    info: "border-primary/30 bg-primary/5 text-primary",
  };
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", styles[tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1">{children}</p>
      </div>
    </div>
  );
}

function formatLocation(address?: string | null, city?: string | null, state?: string | null, zip?: string | null) {
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");
  const parts = [address, cityStateZip.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : "Not specified";
}
