import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, HelpCircle, XCircle } from "lucide-react";
import { acceptQuoteAction, askQuoteQuestionAction, declineQuoteAction } from "@/app/actions";
import { CompanyLogo } from "@/components/company-logo";
import { companyHeaderLogoUrl } from "@/lib/company-branding";
import { prisma } from "@/lib/prisma";
import { currency } from "@/lib/utils";
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
    include: { company: true, customerSnapshot: true, vehicles: true },
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

  return (
    <div className="min-h-screen bg-muted/40 p-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Card>
          <CardHeader className="space-y-4">
            <CompanyLogo
              name={quote.company.name}
              legalName={quote.company.legalName}
              logoUrl={companyHeaderLogoUrl(quote.company)}
              variant="header"
            />
            <div>
              <CardDescription>{quote.company.name}</CardDescription>
              <CardTitle className="text-2xl">Quote {quote.quoteNumber}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            {isAccepted && (
              <div className="flex items-start gap-3 rounded-md border border-secondary/30 bg-secondary/10 p-4 text-secondary">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Quote accepted</p>
                  <p className="mt-1 text-sm">
                    Thank you{quote.customerSignature ? `, ${quote.customerSignature}` : ""}. {quote.company.name} has been notified.
                  </p>
                </div>
              </div>
            )}

            {isDeclined && (
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Quote declined</p>
                  <p className="mt-1 text-sm">Your response has been recorded. {quote.company.name} has been notified.</p>
                </div>
              </div>
            )}

            {questionSubmitted && (
              <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-primary">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Question submitted</p>
                  <p className="mt-1 text-sm">{quote.company.name} will follow up with you soon.</p>
                </div>
              </div>
            )}

            <div className="grid gap-4 text-sm md:grid-cols-2">
              <Detail label="Customer" value={quote.customerSnapshot.name} />
              <Detail label="Quote total" value={currency(quote.customerTotal.toString())} />
              <Detail label="Pickup" value={pickupLocation} />
              <Detail label="Delivery" value={deliveryLocation} />
              <Detail label="Vehicle / shipment" value={vehicleInfo} />
              {quote.trailerType && <Detail label="Trailer type" value={quote.trailerType} />}
            </div>

            {quote.quotePdfUrl && (
              <Button asChild variant="outline">
                <Link href={quote.quotePdfUrl} target="_blank" rel="noopener noreferrer">
                  Download PDF copy (optional)
                </Link>
              </Button>
            )}

            {quote.customerNotes && (
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-medium">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{quote.customerNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {!isAccepted && !isDeclined && (
          <Card>
            <CardHeader>
              <CardTitle>Accept quote</CardTitle>
              <CardDescription>Type your name and agree to the terms to accept this quote.</CardDescription>
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
                  <div className="rounded-md border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
                    {quote.company.defaultTerms}
                  </div>
                )}
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="agreeTerms" className="mt-1 h-4 w-4" required />
                  <span>I agree to the quote terms and authorize {quote.company.name} to proceed based on this quote.</span>
                </label>
                <Button type="submit" className="w-full">
                  Accept quote
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!isAccepted && !isDeclined && (
          <Card>
            <CardHeader>
              <CardTitle>Decline quote</CardTitle>
              <CardDescription>Let us know why this quote does not work for you.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={declineQuoteAction} className="space-y-4">
                <input type="hidden" name="token" value={routeParams.token} />
                <div className="space-y-2">
                  <Label htmlFor="declineReason">Reason for declining</Label>
                  <Textarea
                    id="declineReason"
                    name="declineReason"
                    placeholder="Tell us why you are declining this quote"
                    required
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full">
                  Decline quote
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ask a question</CardTitle>
            <CardDescription>Send a message to {quote.company.name} about this quote.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={askQuoteQuestionAction} className="space-y-4">
              <input type="hidden" name="token" value={routeParams.token} />
              <div className="space-y-2">
                <Label htmlFor="customerName">Your name</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  defaultValue={quote.customerSnapshot.name}
                  placeholder="Your name"
                  required
                />
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

function formatLocation(address?: string | null, city?: string | null, state?: string | null, zip?: string | null) {
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");
  const parts = [address, cityStateZip.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : "Not specified";
}
