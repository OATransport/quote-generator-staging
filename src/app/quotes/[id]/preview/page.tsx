import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { prisma } from "@/lib/prisma";
import { companyHeaderLogoUrl } from "@/lib/company-branding";
import { resolveLiveQuoteUrl } from "@/lib/live-quote-url";
import { quoteModeLabel } from "@/lib/quote";
import { signedFeeAmount } from "@/lib/quote-fees";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function QuotePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const isPrint = query.print === "1";
  const quote = await prisma.quote.findUnique({
    where: { id: routeParams.id },
    include: { company: true, customerSnapshot: true, vehicles: true, fees: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) notFound();
  const vehicle = quote.vehicles[0];
  const visibleFees = quote.fees.filter((fee) => fee.isEnabled && fee.showOnPdf && !fee.isInternalOnly);
  const liveQuoteUrl = resolveLiveQuoteUrl(quote);

  return (
    <div className="bg-muted/40 p-4 lg:p-8">
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Print preview for optional PDF generation. Customers receive the live quote link as the primary quote.
        </p>
        <Button asChild variant="outline">
          <Link href={`/quotes/${quote.id}/edit`}>
            <ArrowLeft className="h-4 w-4" /> Back to edit
          </Link>
        </Button>
      </div>
      <article className="mx-auto min-h-[960px] max-w-4xl rounded-lg bg-white p-10 shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b pb-8">
          <div className="space-y-3">
            <CompanyLogo
              name={quote.company.name}
              legalName={quote.company.legalName}
              logoUrl={companyHeaderLogoUrl(quote.company)}
              variant="header"
              absoluteUrls={isPrint}
            />
            <div>
              <p className="text-sm font-semibold uppercase text-secondary">{quote.company.legalName}</p>
              <h1 className="mt-2 text-4xl font-bold tracking-normal">Transport Quote</h1>
              <p className="mt-2 text-muted-foreground">{quoteModeLabel(quote.quoteMode)}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-2xl font-bold tracking-normal">{quote.quoteNumber}</p>
            <p>Created {quote.createdAt.toLocaleDateString()}</p>
            {quote.validUntil && <p>Valid until {quote.validUntil.toLocaleDateString()}</p>}
            {quote.company.phone && <p className="mt-3">{quote.company.phone}</p>}
            {quote.company.email && <p>{quote.company.email}</p>}
            {quote.company.website && <p>{quote.company.website}</p>}
          </div>
        </header>

        <section className="grid gap-8 border-b py-8 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Customer</h2>
            <p className="mt-3 text-lg font-semibold">{quote.customerSnapshot.name}</p>
            <p>{quote.customerSnapshot.email}</p>
            <p>{quote.customerSnapshot.phone}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Vehicle</h2>
            <p className="mt-3 text-lg font-semibold">
              {vehicle?.year} {vehicle?.make} {vehicle?.model}
            </p>
            <p>
              {quote.pickupCity}, {quote.pickupState} to {quote.deliveryCity}, {quote.deliveryState}
            </p>
          </div>
        </section>

        <section className="py-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3">Line item</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleFees.map((fee) => (
                <tr className="border-b" key={fee.id}>
                  <td className="py-3">{fee.label}</td>
                  <td className="py-3 text-right">{currency(signedFeeAmount(fee))}</td>
                </tr>
              ))}
              <tr className="border-b">
                <td className="py-3">Deposit due</td>
                <td className="py-3 text-right">{currency(quote.depositDue.toString())}</td>
              </tr>
              <tr className="border-b">
                <td className="py-3">Balance due</td>
                <td className="py-3 text-right">{currency(quote.balanceDue.toString())}</td>
              </tr>
              <tr>
                <td className="py-5 text-xl font-bold">Customer total</td>
                <td className="py-5 text-right text-2xl font-bold">{currency(quote.customerTotal.toString())}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="grid gap-8 border-t pt-8 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Live quote link</h2>
            <p className="mt-3 break-all text-sm">{liveQuoteUrl}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Terms</h2>
            <p className="mt-3 text-sm leading-6">{quote.company.defaultTerms}</p>
          </div>
        </section>

        {quote.customerNotes && <p className="mt-8 rounded-md bg-muted p-4 text-sm">{quote.customerNotes}</p>}
      </article>
    </div>
  );
}
