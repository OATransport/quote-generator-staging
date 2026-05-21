import { prisma } from "@/lib/prisma";
import {
  buildQuoteListOrderBy,
  buildQuoteListWhere,
  type QuoteListSearchParams,
} from "@/lib/quote-list";
import { QuoteListFilters, QuoteListHeader } from "@/components/quote-list-toolbar";
import { QuoteListTable } from "@/components/quote-list-table";

export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<QuoteListSearchParams>;
}) {
  const params = await searchParams;
  const where = buildQuoteListWhere(params);
  const orderBy = buildQuoteListOrderBy(params.sort);

  const quotes = await prisma.quote.findMany({
    where,
    orderBy,
    include: { company: true, customerSnapshot: true, vehicles: true },
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="space-y-6 p-6 lg:p-8">
        <QuoteListHeader params={params} />
        <QuoteListFilters params={params} />
        <QuoteListTable quotes={quotes} params={params} />
      </div>
    </div>
  );
}
