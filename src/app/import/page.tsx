import { Search } from "lucide-react";
import { importGhlOpportunityAction } from "@/app/actions";
import { GhlAccountSelect } from "@/components/ghl-account-select";
import { MockGhlBanner } from "@/components/mock-ghl-banner";
import { resolveGhlImportAccountKey } from "@/lib/ghl-accounts";
import { isMockGhlMode, searchGhlPipelineOpportunities } from "@/server/ghl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; account?: string; error?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const account = resolveGhlImportAccountKey(params.account);
  const mockMode = isMockGhlMode();
  let results: Awaited<ReturnType<typeof searchGhlPipelineOpportunities>> = [];
  let error: string | undefined;

  if (mockMode || query) {
    try {
      results = await searchGhlPipelineOpportunities(query, { account });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Unable to search GoHighLevel opportunities.";
    }
  }

  const showResults = mockMode || Boolean(query);

  return (
    <div className="max-w-5xl space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Import from existing GHL pipeline</p>
        <h2 className="text-3xl font-bold tracking-normal">Find a pipeline lead</h2>
      </div>
      {mockMode && <MockGhlBanner />}
      <Card>
        <CardHeader>
          <CardTitle>Search existing opportunities</CardTitle>
          <CardDescription>
            {mockMode
              ? "Sample pipeline leads are shown below for local testing. Search to filter mock opportunities."
              : "Search the selected GHL account quote pipeline by customer name, email, phone, opportunity name, or opportunity ID."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action="/import" className="grid gap-3 md:grid-cols-[1fr_260px_120px]" method="get">
            <div className="space-y-2">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={query} placeholder="Customer, email, phone, opportunity name, or ID" />
            </div>
            <GhlAccountSelect defaultValue={account} />
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
          </form>

          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          {showResults && !error && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">Opportunity</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3 text-right">Import</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{result.name}</p>
                        <p className="text-xs text-muted-foreground">{result.id}</p>
                      </td>
                      <td className="p-3">{result.customerName ?? "Unknown customer"}</td>
                      <td className="p-3">
                        <p>{result.email ?? "No email"}</p>
                        <p className="text-muted-foreground">{result.phone ?? "No phone"}</p>
                      </td>
                      <td className="p-3">{result.stageId ?? "Unstaged"}</td>
                      <td className="p-3 text-right">
                        <form action={importGhlOpportunityAction}>
                          <input type="hidden" name="opportunityId" value={result.id} />
                          <input type="hidden" name="account" value={account} />
                          <input type="hidden" name="returnPath" value="/import" />
                          <Button type="submit" variant="secondary" size="sm">
                            Import
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {!results.length && (
                    <tr>
                      <td className="p-6 text-muted-foreground" colSpan={5}>
                        No matching opportunities were found in the configured pipeline.
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
