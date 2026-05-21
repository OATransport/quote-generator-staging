import Link from "next/link";
import { Plug, Plus } from "lucide-react";
import {
  buildQuotesListUrl,
  parseArchivedFilter,
  QUOTE_STATUS_OPTIONS,
  type QuoteListSearchParams,
} from "@/lib/quote-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function QuoteListFilters({ params }: { params: QuoteListSearchParams }) {
  const archived = parseArchivedFilter(params.archived);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <form method="get" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_repeat(4,minmax(0,140px))]">
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="q">Search</Label>
              <Input
                id="q"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Quote #, customer, route, vehicle…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <select
                id="company"
                name="company"
                defaultValue={params.company ?? "all"}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="oat">OAT</option>
                <option value="keener">Keener</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? "all"}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All</option>
                {QUOTE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <select
                id="source"
                name="source"
                defaultValue={params.source ?? "all"}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="ghl">GHL imported</option>
                <option value="manual">Manual / sample</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="archived">Archive</Label>
              <select
                id="archived"
                name="archived"
                defaultValue={params.archived ?? "0"}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="0">Active</option>
                <option value="1">Archived</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Label htmlFor="sort">Sort by</Label>
              <select
                id="sort"
                name="sort"
                defaultValue={params.sort ?? "updated_desc"}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-56"
              >
                <option value="updated_desc">Newest updated</option>
                <option value="updated_asc">Oldest updated</option>
                <option value="created_desc">Created newest</option>
                <option value="created_asc">Created oldest</option>
                <option value="status">Status</option>
                <option value="company">Company</option>
                <option value="customer">Customer name</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Apply filters</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/quotes">Reset</Link>
              </Button>
            </div>
          </div>
          {archived !== "active" ? (
            <p className="text-xs text-muted-foreground">
              Showing {archived === "archived" ? "archived" : "all"} quotes.{" "}
              <Link href={buildQuotesListUrl({ ...params, archived: "0" })} className="font-medium text-primary">
                Back to active quotes
              </Link>
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function QuoteListHeader({ params }: { params: QuoteListSearchParams }) {
  const archived = parseArchivedFilter(params.archived);
  const archivedHref =
    archived === "archived"
      ? buildQuotesListUrl({ ...params, archived: "0" })
      : buildQuotesListUrl({ ...params, archived: "1" });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Active quote workspace</p>
        <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Search, filter, and manage quotes. Live quote links are the primary delivery method — PDFs are optional.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/import">
            <Plug className="h-4 w-4" /> Import from GHL
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={archivedHref}>{archived === "archived" ? "View active quotes" : "View archived quotes"}</Link>
        </Button>
        <Button type="button" variant="secondary" disabled title="Manual quote creation coming soon">
          <Plus className="h-4 w-4" /> Manual quote
        </Button>
      </div>
    </div>
  );
}
