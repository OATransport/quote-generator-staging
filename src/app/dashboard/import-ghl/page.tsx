import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { importGhlOpportunityAction } from "@/app/actions";
import { GhlAccountSelect } from "@/components/ghl-account-select";
import { MockGhlBanner } from "@/components/mock-ghl-banner";
import { PendingButton } from "@/components/pending-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveGhlImportAccountKey } from "@/lib/ghl-accounts";
import { ACTIVE_QUOTE_STATUSES, isMockGhlMode, searchGhlPipelineOpportunities } from "@/server/ghl";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ImportGhlPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stageId?: string; account?: string; error?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const selectedStageId = params.stageId ?? "";
  const account = resolveGhlImportAccountKey(params.account);
  const mockMode = isMockGhlMode();
  let results: Awaited<ReturnType<typeof searchGhlPipelineOpportunities>> = [];
  let error = params.error === "missing-opportunity" ? "Choose an opportunity before importing." : undefined;

  try {
    results = await searchGhlPipelineOpportunities(query, {
      stageId: selectedStageId || undefined,
      account,
    });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Unable to load GoHighLevel pipeline opportunities.";
  }

  const stageOptions = Array.from(
    new Set(results.map((result) => result.stageId).filter((stageId): stageId is string => Boolean(stageId))),
  ).sort();
  const opportunityIds = results.map((result) => result.id);
  const existingQuotes = opportunityIds.length
    ? await prisma.quote.findMany({
        where: {
          ghlOpportunityId: { in: opportunityIds },
          status: { in: ACTIVE_QUOTE_STATUSES },
        },
        select: { id: true, ghlOpportunityId: true },
      })
    : [];
  const existingQuoteByOpportunityId = new Map(existingQuotes.map((quote) => [quote.ghlOpportunityId, quote.id]));

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Configured GoHighLevel pipeline</p>
        <h2 className="text-3xl font-bold tracking-normal">Import From GHL Pipeline</h2>
      </div>

      {mockMode && <MockGhlBanner />}

      <Card>
        <CardHeader>
          <CardTitle>Pipeline leads</CardTitle>
          <CardDescription>
            {mockMode
              ? "Sample pipeline leads are shown below for local testing. Search or filter by mock stage."
              : "Choose a GHL account, search existing opportunities, then import the selected contact/opportunity/custom-field snapshot into a quote."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action="/dashboard/import-ghl" className="grid gap-3 lg:grid-cols-[1fr_260px_260px_120px]" method="get">
            <div className="space-y-2">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={query} placeholder="Name, phone, email, opportunity name, or ID" />
            </div>
            <GhlAccountSelect defaultValue={account} />
            <div className="space-y-2">
              <Label htmlFor="stageId">Pipeline stage</Label>
              <select
                id="stageId"
                name="stageId"
                defaultValue={selectedStageId}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All configured stages</option>
                {stageOptions.map((stageId) => (
                  <option key={stageId} value={stageId}>
                    {stageId}
                  </option>
                ))}
                {selectedStageId && !stageOptions.includes(selectedStageId) && (
                  <option value={selectedStageId}>{selectedStageId}</option>
                )}
              </select>
            </div>
            <div className="flex items-end">
              <PendingButton type="submit" className="w-full" pendingText="Searching...">
                <Search className="h-4 w-4" /> Search
              </PendingButton>
            </div>
          </form>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!error && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Opportunity name</th>
                    <th className="p-3">Pipeline stage</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Updated</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => {
                    const existingQuoteId = existingQuoteByOpportunityId.get(result.id);
                    return (
                      <tr key={result.id} className="border-t align-top">
                        <td className="p-3 font-medium">{result.customerName ?? "Unknown customer"}</td>
                        <td className="p-3">{result.phone ?? "No phone"}</td>
                        <td className="p-3">{result.email ?? "No email"}</td>
                        <td className="p-3">
                          <p>{result.name}</p>
                          <p className="text-xs text-muted-foreground">{result.id}</p>
                        </td>
                        <td className="p-3">{result.stageId ?? "Unstaged"}</td>
                        <td className="p-3">{formatDate(result.createdAt)}</td>
                        <td className="p-3">{formatDate(result.updatedAt)}</td>
                        <td className="p-3 text-right">
                          {existingQuoteId ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/quotes/${existingQuoteId}/edit`}>
                                Open Existing Quote <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          ) : (
                            <form action={importGhlOpportunityAction}>
                              <input type="hidden" name="opportunityId" value={result.id} />
                              <input type="hidden" name="account" value={account} />
                              <input type="hidden" name="returnPath" value="/dashboard/import-ghl" />
                              <PendingButton type="submit" size="sm" variant="secondary" pendingText="Importing...">
                                Import to Quote
                              </PendingButton>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!results.length && (
                    <tr>
                      <td className="p-8 text-center text-muted-foreground" colSpan={8}>
                        No opportunities found for the configured pipeline and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
