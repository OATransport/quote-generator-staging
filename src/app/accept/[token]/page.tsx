import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { acceptQuoteAction, askQuoteQuestionAction, declineQuoteAction } from "@/app/actions";
import { CompanyLogo } from "@/components/company-logo";
import { companyHeaderLogoUrl } from "@/lib/company-branding";
import { isKeenerCompany, resolveCompanyContact } from "@/lib/company-contact";
import { feeShowsOnCustomerQuote } from "@/lib/customer-quote-fees";
import { prisma } from "@/lib/prisma";
import { formatRouteLocation } from "@/lib/route-format";
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
    include: { company: true, customerSnapshot: true, vehicles: true, fees: true },
  });
  if (!quote) notFound();

  const vehicle = quote.vehicles[0];
  const isAccepted = quote.status === "ACCEPTED" || query.accepted === "1";
  const isDeclined = quote.status === "DECLINED" || query.declined === "1";
  const questionSubmitted = query.question === "1";
  const errorMessage = query.error ? errorMessages[query.error] ?? "Something went wrong. Please try again." : undefined;
  const pickup = formatRouteLocation(quote.pickupAddress, quote.pickupCity, quote.pickupState, quote.pickupZip);
  const delivery = formatRouteLocation(quote.deliveryAddress, quote.deliveryCity, quote.deliveryState, quote.deliveryZip);
  const vehicleInfo = [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.type].filter(Boolean).join(" ") || "Not specified";
  const customerLineItems = quote.fees.filter((fee) => feeShowsOnCustomerQuote(fee));
  const isKeener = isKeenerCompany(quote.company.name);
  const contact = resolveCompanyContact(quote.company.name);
  const brandHeader = isKeener ? "bg-slate-950" : "bg-sky-900";
  const brandAccent = isKeener ? "text-slate-900" : "text-sky-900";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className={cn("px-6 py-8 text-white sm:px-8", brandHeader)}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="rounded-xl bg-white/95 p-4 shadow-sm">
                  <CompanyLogo
                    name={quote.company.name}
                    legalName={quote.company.legalName}
                    logoUrl={companyHeaderLogoUrl(quote.company)}
                    variant="header"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">Your transportation quote</p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{quote.quoteNumber}</h1>
                  <p className="mt-2 text-lg text-white/90">{quote.customerSnapshot.name}</p>
                </div>
              </div>
              <div className="space-y-3 lg:text-right">
                <StatusPill status={quote.status} accepted={isAccepted} declined={isDeclined} />
                {contact ? (
                  <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-sm backdrop-blur">
                    <p className="font-medium text-white">Questions? Contact us</p>
                    <div className="mt-3 space-y-2 text-white/90">
                      <ContactRow icon={Phone} href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} label={contact.phone} />
                      <ContactRow icon={Mail} href={`mailto:${contact.email}`} label={contact.email} />
                      <ContactRow icon={ShieldCheck} href={contact.website} label={contact.websiteLabel} external />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-8">
            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            {isAccepted ? (
              <AlertBanner tone="success" icon={CheckCircle} title="Quote accepted">
                Thank you{quote.customerSignature ? `, ${quote.customerSignature}` : ""}. {quote.company.name} has been notified and will follow up on next steps.
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

            <section className="grid gap-4 md:grid-cols-2">
              <RouteCard title="Pickup" icon={MapPin} lines={pickup.lines} isKeener={isKeener} />
              <RouteCard title="Delivery" icon={MapPin} lines={delivery.lines} isKeener={isKeener} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-0 shadow-sm ring-1 ring-black/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Vehicle & shipment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Vehicle" value={vehicleInfo} />
                  <Detail label="Customer" value={quote.customerSnapshot.name} />
                  {quote.trailerType ? <Detail label="Trailer type" value={quote.trailerType} /> : null}
                  {vehicle?.condition ? <Detail label="Condition" value={vehicle.condition} /> : null}
                </CardContent>
              </Card>

              <Card className={cn("border-0 shadow-md ring-1 ring-black/5", isKeener ? "bg-slate-50" : "bg-sky-50")}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Your quote</CardTitle>
                  <CardDescription>Review your total, deposit, and balance due.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quote total</p>
                    <p className={cn("mt-1 text-4xl font-bold tracking-tight", brandAccent)}>
                      {currency(quote.customerTotal.toString())}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PriceTile label="Deposit due" value={currency(quote.depositDue.toString())} />
                    <PriceTile label="Balance due" value={currency(quote.balanceDue.toString())} />
                  </div>
                  {customerLineItems.length > 0 ? (
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included items</p>
                      {customerLineItems.map((fee) => (
                        <div key={fee.id} className="flex justify-between gap-3 text-sm">
                          <span>{fee.label}</span>
                          <span className="font-medium">{currency(fee.amount.toString())}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            {quote.customerNotes ? (
              <div className="rounded-xl border bg-muted/30 p-5 text-sm">
                <p className="font-semibold">Notes from {quote.company.name}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{quote.customerNotes}</p>
              </div>
            ) : null}

            <section className="rounded-xl border bg-muted/20 p-5">
              <p className="text-sm font-semibold">What happens next</p>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <StepNumber>1</StepNumber>
                  <span>Review your route, vehicle details, and pricing above.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber>2</StepNumber>
                  <span>Accept the quote when you are ready to move forward.</span>
                </li>
                <li className="flex gap-3">
                  <StepNumber>3</StepNumber>
                  <span>{quote.company.name} confirms dispatch details and next steps with you.</span>
                </li>
              </ol>
              <div className="mt-5 space-y-2 text-xs leading-5 text-muted-foreground">
                <p>No PDF is required to approve this quote.</p>
                <p>Quote details can be confirmed by phone or email if you prefer.</p>
                <p>
                  Final dispatch depends on carrier availability, route conditions, vehicle condition, and the details you provide.
                </p>
              </div>
            </section>

            {!isAccepted && !isDeclined ? (
              <Card className="border-0 shadow-lg ring-2 ring-primary/20">
                <CardHeader>
                  <CardTitle className="text-xl">Accept this quote</CardTitle>
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
                    {quote.company.defaultTerms ? (
                      <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                        {quote.company.defaultTerms}
                      </div>
                    ) : null}
                    <label className="flex items-start gap-3 text-sm">
                      <input type="checkbox" name="agreeTerms" className="mt-1 h-4 w-4" required />
                      <span>I agree to the quote terms and authorize {quote.company.name} to proceed based on this quote.</span>
                    </label>
                    <Button type="submit" className="h-12 w-full text-base font-semibold">
                      Accept quote
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {!isAccepted && !isDeclined ? (
                <Card className="border shadow-sm">
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
              ) : null}

              <Card className="border shadow-sm">
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
                      Ask a question
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {quote.quotePdfUrl ? (
              <div className="text-center">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href={quote.quotePdfUrl} target="_blank" rel="noopener noreferrer">
                    Download optional PDF copy
                  </Link>
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
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2 transition hover:text-white"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function RouteCard({
  title,
  icon: Icon,
  lines,
  isKeener,
}: {
  title: string;
  icon: typeof MapPin;
  lines: string[];
  isKeener: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn("rounded-lg p-2 text-white", isKeener ? "bg-slate-800" : "bg-sky-700")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <div className="mt-2 space-y-1">
            {lines.map((line) => (
              <p key={line} className="text-sm font-medium leading-6 text-foreground">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepNumber({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {children}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function PriceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
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
