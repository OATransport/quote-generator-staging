import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  HelpCircle,
  Mail,
  Phone,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { acceptQuoteAction, askQuoteQuestionAction, declineQuoteAction } from "@/app/actions";
import { CompanyLogo } from "@/components/company-logo";
import { PublicQuoteRouteVisual } from "@/components/public-quote-route-visual";
import { companyHeaderLogoUrl } from "@/lib/company-branding";
import { isKeenerCompany, resolveCompanyContact } from "@/lib/company-contact";
import { getQuoteModelConfig } from "@/lib/quote-model";
import { isQuotePubliclyActive } from "@/lib/quote-active";
import { isBreakdownMetaFee, readShowItemizedBreakdown } from "@/lib/quote-pricing";
import { prisma } from "@/lib/prisma";
import { formatRouteLocation, formatRouteSummaryShort } from "@/lib/route-format";
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
  const breakdownItems = quote.fees.filter(
    (fee) =>
      fee.feeType === "CUSTOM" &&
      !isBreakdownMetaFee(fee) &&
      !fee.isInternalOnly &&
      fee.showOnPdf &&
      showItemizedBreakdown,
  );
  const brandGradient = isKeener ? "from-slate-950 via-slate-900 to-slate-800" : "from-sky-950 via-sky-900 to-sky-800";
  const brandAccent = isKeener ? "text-slate-900" : "text-sky-900";
  const pickupDateLabel = quote.pickupDate
    ? quote.pickupDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : quote.deliveryWindow || null;

  if (!isActive) {
    return (
      <InactiveQuotePage quote={quote} contact={contact} brandGradient={brandGradient} />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#e2e8f0_100%)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
        <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl shadow-slate-300/30">
          <div className={cn("relative px-6 py-10 text-white sm:px-10", `bg-gradient-to-br ${brandGradient}`)}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_40%)]" />
            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div className="space-y-7">
                <CompanyLogo
                  name={quote.company.name}
                  legalName={quote.company.legalName}
                  logoUrl={companyHeaderLogoUrl(quote.company)}
                  variant="public"
                />
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/70">Vehicle transportation quote</p>
                  <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem]">{quote.quoteNumber}</h1>
                  <p className="mt-3 max-w-xl text-lg text-white/90 sm:text-xl">Prepared for {quote.customerSnapshot.name}</p>
                </div>
                <StatusPill status={quote.status} accepted={isAccepted} declined={isDeclined} />
              </div>

              {contact ? (
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Contact {quote.company.name}</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <ContactRow icon={Phone} href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} label={contact.phone} />
                    <ContactRow icon={Mail} href={`mailto:${contact.email}`} label={contact.email} />
                    <ContactRow icon={ShieldCheck} href={contact.website} label={contact.websiteLabel} external />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
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

            <PublicQuoteRouteVisual pickup={pickup} delivery={delivery} routeSummary={routeSummary} isKeener={isKeener} />

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-0 shadow-md ring-1 ring-black/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">Vehicle & shipment details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {vehicleInfo ? <Detail label="Vehicle" value={vehicleInfo} /> : null}
                  <Detail label="Customer" value={quote.customerSnapshot.name} />
                  {quote.trailerType ? <Detail label="Transport type" value={quote.trailerType} /> : null}
                  {vehicle?.condition ? <Detail label="Running status" value={vehicle.condition} /> : null}
                  {pickupDateLabel ? <Detail label="Pickup date / window" value={pickupDateLabel} /> : null}
                  {vehicle?.type ? <Detail label="Vehicle type" value={vehicle.type} /> : null}
                </CardContent>
              </Card>

              <Card className={cn("border-0 shadow-lg ring-2", isKeener ? "bg-slate-50 ring-slate-200" : "bg-sky-50 ring-sky-200")}>
                <CardHeader>
                  <CardTitle className="text-xl">Your transportation quote</CardTitle>
                  <CardDescription>{quoteModel.pricingCardDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <PricingRow
                    label={quoteModel.customerServicePriceLabel}
                    value={currency(quote.customerTotal.toString())}
                    emphasis
                    accent={brandAccent}
                  />
                  <PricingRow label={quoteModel.depositLabel} value={currency(quote.depositDue.toString())} />
                  <PricingRow label={quoteModel.balanceDueLabel} value={currency(quote.balanceDue.toString())} />
                  <p className="text-xs leading-5 text-muted-foreground">{quoteModel.balanceDueHelper}</p>

                  {breakdownItems.length > 0 ? (
                    <details className="rounded-xl border bg-white/80 p-4">
                      <summary className="cursor-pointer text-sm font-semibold">View itemized breakdown</summary>
                      <div className="mt-3 space-y-2">
                        {breakdownItems.map((fee) => (
                          <div key={fee.id} className="flex justify-between gap-3 text-sm">
                            <span>{fee.label}</span>
                            <span className="font-medium">{currency(fee.amount.toString())}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                      Vehicle Transportation Service — one clear quoted price for your shipment.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {quote.customerNotes ? (
              <div className="rounded-2xl border bg-muted/20 p-5">
                <p className="font-semibold">Notes from {quote.company.name}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{quote.customerNotes}</p>
              </div>
            ) : null}

            <section className="rounded-2xl border bg-slate-50 p-6">
              <p className="font-semibold">What happens next</p>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>1. Review your route, vehicle details, and transportation service price.</li>
                <li>2. Accept the quote when you are ready to move forward.</li>
                <li>3. {quote.company.name} confirms dispatch details and next steps with you.</li>
              </ol>
              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                No PDF is required. Quote details can be confirmed by phone or email. Final dispatch depends on carrier availability, route conditions, vehicle condition, and customer-provided details.
              </p>
            </section>

            {!isAccepted && !isDeclined ? (
              <Card className="border-0 bg-slate-950 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Accept this quote</CardTitle>
                  <CardDescription className="text-slate-300">
                    Secure your transportation service by approving this quote today.
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
              <div className="grid gap-4 lg:grid-cols-2">
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
              <footer className="border-t pt-6 text-center text-sm text-muted-foreground">
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
            variant="public"
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
    <details className="group rounded-2xl border bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t px-5 py-4">{children}</div>
    </details>
  );
}

function ContactRow({
  icon: Icon,
  href,
  label,
  external,
}: {
  icon: typeof Phone;
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="flex items-center gap-2 hover:text-white">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}

function PricingRow({
  label,
  value,
  emphasis,
  accent,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-white/80 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-bold", emphasis ? cn("text-3xl tracking-tight", accent) : "text-2xl")}>{value}</p>
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
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", styles)}>{label}</span>;
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
