import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  HelpCircle,
  Truck,
  XCircle,
} from "lucide-react";
import { acceptQuoteAction, askQuoteQuestionAction, declineQuoteAction } from "@/app/actions";
import { CompanyLogo } from "@/components/company-logo";
import { PublicQuoteHero } from "@/components/public-quote-hero";
import { PublicQuoteImportantDetails } from "@/components/public-quote-important-details";
import { PublicQuotePricingCard } from "@/components/public-quote-pricing-card";
import { PublicQuoteRouteVisual } from "@/components/public-quote-route-visual";
import { companyHeaderLogoUrl } from "@/lib/company-branding";
import { isKeenerCompany, resolveCompanyContact } from "@/lib/company-contact";
import { getQuoteModelConfig } from "@/lib/quote-model";
import { isQuotePubliclyActive } from "@/lib/quote-active";
import { getPublicBreakdownItems } from "@/lib/quote-breakdown";
import { hasDepositDue } from "@/lib/public-quote-deposit";
import { lookupZip } from "@/lib/zip-lookup";
import { readShowItemizedBreakdown } from "@/lib/quote-pricing";
import { prisma } from "@/lib/prisma";
import { formatRouteLocation, formatRouteSummaryShort } from "@/lib/route-format";
import { cn } from "@/lib/utils";
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
  "quote-inactive": "This quote is no longer active.",
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
    include: { company: true, customerSnapshot: true, vehicles: true, fees: true },
  });
  if (!quote) notFound();

  const vehicle = quote.vehicles[0];
  const isActive = isQuotePubliclyActive(quote);
  const isAccepted = quote.status === "ACCEPTED" || query.accepted === "1";
  const isDeclined = quote.status === "DECLINED" || query.declined === "1";
  const questionSubmitted = query.question === "1";
  const errorMessage = query.error ? errorMessages[query.error] ?? "Something went wrong. Please try again." : undefined;
  const pickup = formatRouteLocation(quote.pickupAddress, quote.pickupCity, quote.pickupState, quote.pickupZip);
  const delivery = formatRouteLocation(quote.deliveryAddress, quote.deliveryCity, quote.deliveryState, quote.deliveryZip);
  const routeSummary = formatRouteSummaryShort(quote.pickupCity, quote.pickupState, quote.deliveryCity, quote.deliveryState);
  const vehicleInfo = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || null;
  const isKeener = isKeenerCompany(quote.company.name);
  const contact = resolveCompanyContact(quote.company.name);
  const quoteModel = getQuoteModelConfig(
    quote.quoteMode === "KEENER_LOGISTICS" || isKeener ? "KEENER_LOGISTICS" : quote.quoteMode,
  );
  const showItemizedBreakdown = readShowItemizedBreakdown(quote.fees);
  const breakdownItems = getPublicBreakdownItems(quote.fees, showItemizedBreakdown);
  const pickupCoordinate = quote.pickupZip ? await resolveRouteCoordinate(quote.pickupZip) : null;
  const deliveryCoordinate = quote.deliveryZip ? await resolveRouteCoordinate(quote.deliveryZip) : null;
  const brandGradient = isKeener ? "from-slate-950 via-slate-900 to-slate-800" : "from-sky-950 via-sky-900 to-sky-800";
  const pickupDateLabel = quote.pickupDate
    ? quote.pickupDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : quote.deliveryWindow || null;
  const depositRequired = hasDepositDue(quote.depositDue);

  if (!isActive) {
    return (
      <InactiveQuotePage quote={quote} contact={contact} brandGradient={brandGradient} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-300/25">
          <PublicQuoteHero
            companyName={quote.company.name}
            legalName={quote.company.legalName}
            logoUrl={companyHeaderLogoUrl(quote.company)}
            quoteNumber={quote.quoteNumber}
            customerName={quote.customerSnapshot.name}
            status={quote.status}
            validUntil={quote.validUntil}
            isKeener={isKeener}
            accepted={isAccepted}
            declined={isDeclined}
            contact={contact}
          />

          <div className="space-y-8 px-5 py-7 sm:space-y-10 sm:px-8 sm:py-9">
            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{errorMessage}</div>
            ) : null}

            {isAccepted ? (
              <AlertBanner tone="success" icon={CheckCircle} title="Quote accepted">
                Thank you{quote.customerSignature ? `, ${quote.customerSignature}` : ""}. {quote.company.name} will follow up on next steps.
              </AlertBanner>
            ) : null}
            {isDeclined ? (
              <AlertBanner tone="danger" icon={XCircle} title="Quote declined">
                Your response has been recorded. {quote.company.name} has been notified.
              </AlertBanner>
            ) : null}
            {questionSubmitted ? (
              <AlertBanner tone="info" icon={HelpCircle} title="Question submitted">
                {quote.company.name} will follow up with you soon.
              </AlertBanner>
            ) : null}

            <PublicQuoteRouteVisual
              pickup={pickup}
              delivery={delivery}
              routeSummary={routeSummary}
              isKeener={isKeener}
              pickupCoordinate={pickupCoordinate}
              deliveryCoordinate={deliveryCoordinate}
              transportType={quote.trailerType}
            />

            <PublicQuotePricingCard
              customerTotal={quote.customerTotal}
              depositDue={quote.depositDue}
              balanceDue={quote.balanceDue}
              showItemizedBreakdown={showItemizedBreakdown}
              breakdownItems={breakdownItems}
              description={quoteModel.pricingCardDescription}
              isKeener={isKeener}
            />

            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Vehicle & shipment details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {vehicleInfo ? <Detail label="Vehicle" value={vehicleInfo} /> : null}
                <Detail label="Customer" value={quote.customerSnapshot.name} />
                {quote.trailerType ? <Detail label="Transport type" value={quote.trailerType} /> : null}
                {vehicle?.condition ? <Detail label="Running status" value={vehicle.condition} /> : null}
                {pickupDateLabel ? <Detail label="Pickup date / window" value={pickupDateLabel} /> : null}
                {vehicle?.type ? <Detail label="Vehicle type" value={vehicle.type} /> : null}
              </CardContent>
            </Card>

            {quote.customerNotes ? (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
                <p className="font-semibold">Notes from {quote.company.name}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{quote.customerNotes}</p>
              </div>
            ) : null}

            <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">What happens next</h2>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <WhatNextStep step={1} text="You accept the quote." />
                <WhatNextStep
                  step={2}
                  text={depositRequired ? "Deposit is confirmed." : "No deposit is required today."}
                />
                <WhatNextStep step={3} text="Dispatch confirms carrier availability and pickup timing." />
                <WhatNextStep step={4} text="Remaining balance is due on delivery unless otherwise noted." />
              </ol>
            </section>

            <PublicQuoteImportantDetails
              quoteMode={quote.quoteMode === "KEENER_LOGISTICS" || isKeener ? "KEENER_LOGISTICS" : quote.quoteMode}
              companyName={quote.company.name}
              hasExpiration={Boolean(quote.validUntil)}
              depositDue={quote.depositDue}
            />

            {!isAccepted && !isDeclined ? (
              <Card className="border-0 bg-slate-950 text-white shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-2xl text-white">Accept this quote</CardTitle>
                  <CardDescription className="text-slate-300">
                    {depositRequired
                      ? "Secure your transportation service by approving this quote and confirming your deposit."
                      : "Secure your transportation service by approving this quote today."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={acceptQuoteAction} className="space-y-4">
                    <input type="hidden" name="token" value={routeParams.token} />
                    <div className="space-y-2">
                      <Label htmlFor="customerSignature" className="text-slate-200">Your full name (signature)</Label>
                      <Input
                        id="customerSignature"
                        name="customerSignature"
                        defaultValue={quote.customerSnapshot.name}
                        className="border-slate-700 bg-slate-900 text-white"
                        required
                      />
                    </div>
                    {quote.company.defaultTerms ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                        {quote.company.defaultTerms}
                      </div>
                    ) : null}
                    <label className="flex items-start gap-3 text-sm text-slate-200">
                      <input type="checkbox" name="agreeTerms" className="mt-1 h-4 w-4" required />
                      <span>I agree to the quote terms and authorize {quote.company.name} to proceed based on this quote.</span>
                    </label>
                    <Button type="submit" className="h-12 w-full bg-white text-base font-semibold text-slate-950 hover:bg-slate-100">
                      Accept quote
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            {!isAccepted && !isDeclined ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <SecondaryAccordion title="Decline quote" description="Optional — tell us why this quote does not work for you.">
                  <form action={declineQuoteAction} className="space-y-4">
                    <input type="hidden" name="token" value={routeParams.token} />
                    <div className="space-y-2">
                      <Label htmlFor="declineReason">Reason for declining</Label>
                      <Textarea id="declineReason" name="declineReason" required />
                    </div>
                    <Button type="submit" variant="outline" className="w-full">Decline quote</Button>
                  </form>
                </SecondaryAccordion>

                <SecondaryAccordion title="Ask a question" description={`Send a message to ${quote.company.name}.`}>
                  <form action={askQuoteQuestionAction} className="space-y-4">
                    <input type="hidden" name="token" value={routeParams.token} />
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Your name</Label>
                      <Input id="customerName" name="customerName" defaultValue={quote.customerSnapshot.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Your question</Label>
                      <Textarea id="message" name="message" required />
                    </div>
                    <Button type="submit" variant="secondary" className="w-full">Ask a question</Button>
                  </form>
                </SecondaryAccordion>
              </div>
            ) : null}

            {quote.quotePdfUrl ? (
              <div className="text-center">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href={quote.quotePdfUrl} target="_blank" rel="noopener noreferrer">Download optional PDF copy</Link>
                </Button>
              </div>
            ) : null}

            {contact ? (
              <footer className="border-t border-slate-200 pt-6 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{quote.company.name}</p>
                <p className="mt-2">
                  {contact.phone} · {contact.email} ·{" "}
                  <Link href={contact.website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {contact.websiteLabel}
                  </Link>
                </p>
              </footer>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatNextStep({ step, text }: { step: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
        {step}
      </span>
      <span className="pt-0.5">{text}</span>
    </li>
  );
}

function InactiveQuotePage({
  quote,
  contact,
  brandGradient,
}: {
  quote: {
    quoteNumber: string;
    company: { name: string; legalName: string | null; logoUrl?: string | null; iconUrl?: string | null };
    customerSnapshot: { name: string };
  };
  contact: ReturnType<typeof resolveCompanyContact>;
  brandGradient: string;
}) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border bg-white p-8 shadow-xl">
        <div className={cn("rounded-2xl px-6 py-8 text-white", `bg-gradient-to-br ${brandGradient}`)}>
          <CompanyLogo
            name={quote.company.name}
            legalName={quote.company.legalName}
            logoUrl={companyHeaderLogoUrl(quote.company)}
            variant="public-hero"
          />
          <h1 className="mt-6 text-3xl font-bold">{quote.quoteNumber}</h1>
        </div>
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">This quote is no longer active.</p>
            <p className="mt-2 text-sm leading-6">
              This link is no longer available for acceptance. Please contact {quote.company.name} if you need an updated quote.
            </p>
          </div>
        </div>
        {contact ? (
          <div className="mt-6 text-sm text-muted-foreground">
            <p>{contact.phone}</p>
            <p>{contact.email}</p>
            <Link href={contact.website} className="underline underline-offset-2">{contact.websiteLabel}</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function resolveRouteCoordinate(zip: string) {
  const result = await lookupZip(zip);
  if ("error" in result) return null;
  return { latitude: result.latitude, longitude: result.longitude };
}

function SecondaryAccordion({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-medium">{value}</p>
    </div>
  );
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
    <div className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", styles[tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1">{children}</p>
      </div>
    </div>
  );
}
