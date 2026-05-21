import Link from "next/link";
import type { Company, CustomerSnapshot, Quote, VehicleSnapshot } from "@prisma/client";
import { ExternalLink, Pencil } from "lucide-react";
import { ArchiveQuoteIconButton } from "@/components/archive-quote-icon-button";
import { CopyLiveQuoteIconButton } from "@/components/copy-live-quote-icon-button";
import { ArchivedBadge, CompanyBadge, FollowUpBadge, QuoteStatusBadge } from "@/components/quote-status-badges";
import { getQuoteFollowUpReasons } from "@/lib/quote-follow-up";
import { formatQuoteRoute, formatQuoteVehicle, parseArchivedFilter, type QuoteListSearchParams } from "@/lib/quote-list";
import { resolveLiveQuoteUrl } from "@/lib/live-quote-url";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plug } from "lucide-react";

type QuoteRow = Quote & {
  company: Company;
  customerSnapshot: CustomerSnapshot;
  vehicles: VehicleSnapshot[];
};

export function QuoteListTable({
  quotes,
  params,
}: {
  quotes: QuoteRow[];
  params: QuoteListSearchParams;
}) {
  const archived = parseArchivedFilter(params.archived);
  const hasFilters = Boolean(params.q || params.company || params.status || params.source);

  if (!quotes.length) {
    return <QuoteListEmptyState archived={archived} hasFilters={hasFilters} />;
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Quote</th>
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Route</th>
                <th className="p-3 font-medium">Vehicle</th>
                <th className="p-3 font-medium">Totals</th>
                <th className="p-3 font-medium">Activity</th>
                <th className="p-3 font-medium">Dates</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const vehicle = quote.vehicles[0];
                const liveUrl = resolveLiveQuoteUrl(quote);
                const followUpReasons = getQuoteFollowUpReasons(quote);
                const isArchived = Boolean(quote.archivedAt);

                return (
                  <tr key={quote.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="p-3 align-top">
                      <div className="space-y-1.5">
                        <Link href={`/quotes/${quote.id}/edit`} className="font-semibold text-primary hover:underline">
                          {quote.quoteNumber}
                        </Link>
                        <div className="flex flex-wrap gap-1">
                          <CompanyBadge name={quote.company.name} />
                          <QuoteStatusBadge status={quote.status} />
                          {isArchived && quote.archivedAt ? <ArchivedBadge archivedAt={quote.archivedAt} /> : null}
                          {followUpReasons.length > 0 ? <FollowUpBadge /> : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <p className="font-medium">{quote.customerSnapshot.name}</p>
                      <p className="text-xs text-muted-foreground">{quote.customerSnapshot.email ?? "No email"}</p>
                      <p className="text-xs text-muted-foreground">{quote.customerSnapshot.phone ?? "No phone"}</p>
                    </td>
                    <td className="p-3 align-top text-muted-foreground">
                      {formatQuoteRoute(quote.pickupCity, quote.pickupState, quote.deliveryCity, quote.deliveryState)}
                    </td>
                    <td className="p-3 align-top">{formatQuoteVehicle(vehicle)}</td>
                    <td className="p-3 align-top">
                      <p className="font-semibold">{currency(quote.customerTotal.toString())}</p>
                      <p className="text-xs text-muted-foreground">Dep: {currency(quote.depositDue.toString())}</p>
                      <p className="text-xs text-muted-foreground">Bal: {currency(quote.balanceDue.toString())}</p>
                    </td>
                    <td className="p-3 align-top text-xs text-muted-foreground">
                      {quote.lastCustomerActionAt ? (
                        <p>Customer: {quote.lastCustomerActionAt.toLocaleDateString()}</p>
                      ) : (
                        <p>No customer action</p>
                      )}
                      {followUpReasons.length > 0 ? (
                        <p className="mt-1 text-amber-800">{followUpReasons[0]}</p>
                      ) : null}
                    </td>
                    <td className="p-3 align-top text-xs text-muted-foreground">
                      <p>Updated {quote.updatedAt.toLocaleDateString()}</p>
                      <p>Created {quote.createdAt.toLocaleDateString()}</p>
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="outline" title="Edit quote">
                          <Link href={`/quotes/${quote.id}/edit`} aria-label="Edit quote">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild size="icon" variant="outline" title="Open live quote">
                          <Link href={liveUrl} target="_blank" rel="noopener noreferrer" aria-label="Open live quote">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <CopyLiveQuoteIconButton url={liveUrl} />
                        {!isArchived ? <ArchiveQuoteIconButton quoteId={quote.id} /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {quotes.length} quote{quotes.length === 1 ? "" : "s"}
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteListEmptyState({
  archived,
  hasFilters,
}: {
  archived: "active" | "archived" | "all";
  hasFilters: boolean;
}) {
  let title = "No active quotes";
  let description = "Import a lead from GoHighLevel to create your first quote.";
  let action = (
    <Button asChild className="mt-4">
      <Link href="/import">
        <Plug className="h-4 w-4" /> Import from GHL
      </Link>
    </Button>
  );

  if (hasFilters) {
    title = "No matching quotes";
    description = "Try adjusting your search or filters, or reset to see all quotes in this view.";
    action = (
      <Button asChild variant="outline" className="mt-4">
        <Link href={archived === "archived" ? "/quotes?archived=1" : archived === "all" ? "/quotes?archived=all" : "/quotes"}>
          Reset filters
        </Link>
      </Button>
    );
  } else if (archived === "archived") {
    title = "No archived quotes";
    description = "Archived quotes are hidden from the active workspace but remain accessible by direct URL.";
    action = (
      <Button asChild variant="outline" className="mt-4">
        <Link href="/quotes">View active quotes</Link>
      </Button>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
