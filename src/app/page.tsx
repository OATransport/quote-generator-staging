import type { ComponentType } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  CheckCircle,
  FileText,
  HelpCircle,
  Plug,
  Plus,
  XCircle,
} from "lucide-react";
import { ReleaseReadinessCard } from "@/components/release-readiness-card";
import { CompanyBadge, FollowUpBadge, QuoteStatusBadge } from "@/components/quote-status-badges";
import { getQuoteFollowUpReasons, quoteNeedsFollowUp } from "@/lib/quote-follow-up";
import { formatQuoteRoute } from "@/lib/quote-list";
import { resolveLiveQuoteUrl } from "@/lib/live-quote-url";
import { prisma } from "@/lib/prisma";
import { currency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const activeWhere = { archivedAt: null };
  const [
    activeCount,
    acceptedCount,
    declinedCount,
    questionCount,
    archivedCount,
    recentImports,
    recentActivity,
    recentNotifications,
    followUpCandidates,
    acceptedRevenue,
  ] = await Promise.all([
    prisma.quote.count({ where: activeWhere }),
    prisma.quote.count({ where: { ...activeWhere, status: "ACCEPTED" } }),
    prisma.quote.count({ where: { ...activeWhere, status: "DECLINED" } }),
    prisma.quote.count({ where: { ...activeWhere, status: "QUESTION" } }),
    prisma.quote.count({ where: { archivedAt: { not: null } } }),
    prisma.quote.findMany({
      where: { ...activeWhere, ghlOpportunityId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customerSnapshot: true, company: true },
    }),
    prisma.quote.findMany({
      where: { ...activeWhere, lastCustomerActionAt: { not: null } },
      orderBy: { lastCustomerActionAt: "desc" },
      take: 5,
      include: { customerSnapshot: true, company: true },
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { quote: { include: { customerSnapshot: true, company: true } } },
    }),
    prisma.quote.findMany({
      where: activeWhere,
      orderBy: { updatedAt: "asc" },
      take: 50,
      include: { customerSnapshot: true, company: true },
    }),
    prisma.quote.aggregate({
      where: { ...activeWhere, status: "ACCEPTED" },
      _sum: { customerTotal: true },
    }),
  ]);

  const followUpQuotes = followUpCandidates.filter(quoteNeedsFollowUp);
  const followUpDisplay = followUpQuotes.slice(0, 8);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="space-y-8 p-6 lg:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Quote command center</p>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Track active quotes, customer responses, and imports. Send live quote links as the primary delivery method.
            </p>
          </div>
          <Button asChild>
            <Link href="/import">
              <Plug className="h-4 w-4" /> Import from GHL
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Active quotes" value={activeCount} href="/quotes" />
          <StatCard title="Accepted" value={acceptedCount} href="/quotes?status=ACCEPTED" accent="success" />
          <StatCard title="Declined" value={declinedCount} href="/quotes?status=DECLINED" accent="danger" />
          <StatCard title="Questions" value={questionCount} href="/quotes?status=QUESTION" accent="warning" />
          <StatCard title="Archived" value={archivedCount} href="/quotes?archived=1" />
          <StatCard title="Needs follow-up" value={followUpQuotes.length} href="/quotes" accent="warning" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/import" icon={Plug} title="Import from GHL" description="Pull a pipeline lead into a quote" />
          <QuickAction href="/quotes" icon={FileText} title="Active quotes" description="Search and manage the quote workspace" />
          <QuickAction href="/quotes?archived=1" icon={Archive} title="Archived quotes" description="Find quotes hidden from active lists" />
          <QuickAction href="#" icon={Plus} title="Manual quote" description="Coming soon" disabled />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Needs follow-up</CardTitle>
                <CardDescription>
                  Questions, declines, unpriced imports, or quotes not updated in 7+ days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuoteMiniList
                  quotes={followUpDisplay}
                  emptyMessage="No quotes need follow-up right now."
                  showReasons
                />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Recent imports</CardTitle>
                  <CardDescription>Latest quotes imported from GoHighLevel.</CardDescription>
                </CardHeader>
                <CardContent>
                  <QuoteMiniList quotes={recentImports} emptyMessage="No GHL imports yet." />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Recent customer activity</CardTitle>
                  <CardDescription>Accept, decline, and question responses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <QuoteMiniList quotes={recentActivity} emptyMessage="No customer responses yet." showActivityDate />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <ReleaseReadinessCard />

            <Card className="border-primary/20 bg-primary/5 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Accepted revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{currency(acceptedRevenue._sum.customerTotal?.toString() ?? 0)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{acceptedCount} accepted quote{acceptedCount === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start" size="sm">
                  <Link href="/settings/companies">Company settings</Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start" size="sm">
                  <Link href="/settings/ghl">GHL field mapping</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Recent notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentNotifications.length ? (
                  recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "rounded-lg border p-3 text-sm",
                        notification.isRead ? "bg-background" : "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <NotificationIcon type={notification.type} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{notification.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {notification.quote.quoteNumber} · {notification.quote.customerSnapshot.name}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/quotes/${notification.quoteId}/edit`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                      >
                        Open quote <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Customer accept, decline, and question responses will appear here.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
  accent,
}: {
  title: string;
  value: number;
  href: string;
  accent?: "success" | "danger" | "warning";
}) {
  const accentClass =
    accent === "success"
      ? "border-emerald-200/80"
      : accent === "danger"
        ? "border-red-200/80"
        : accent === "warning"
          ? "border-amber-200/80"
          : "";

  return (
    <Link href={href}>
      <Card className={cn("shadow-sm transition-colors hover:bg-muted/30", accentClass)}>
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  disabled,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  const content = (
    <Card className={cn("h-full shadow-sm", disabled ? "opacity-60" : "transition-colors hover:bg-muted/30")}>
      <CardContent className="flex h-full flex-col p-4">
        <Icon className="h-5 w-5 text-primary" />
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (disabled) return content;
  return <Link href={href}>{content}</Link>;
}

type MiniQuote = {
  id: string;
  quoteNumber: string;
  status: string;
  customerTotal: { toString(): string };
  updatedAt: Date;
  lastCustomerActionAt?: Date | null;
  archivedAt?: Date | null;
  secureAccessToken: string;
  acceptanceUrl?: string | null;
  pickupCity: string | null;
  pickupState: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  company: { name: string };
  customerSnapshot: { name: string };
};

function QuoteMiniList({
  quotes,
  emptyMessage,
  showReasons,
  showActivityDate,
}: {
  quotes: MiniQuote[];
  emptyMessage: string;
  showReasons?: boolean;
  showActivityDate?: boolean;
}) {
  if (!quotes.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {quotes.map((quote) => {
        const reasons = showReasons ? getQuoteFollowUpReasons(quote) : [];
        return (
          <div key={quote.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/quotes/${quote.id}/edit`} className="font-semibold text-primary hover:underline">
                  {quote.quoteNumber}
                </Link>
                <CompanyBadge name={quote.company.name} />
                <QuoteStatusBadge status={quote.status} />
                {reasons.length > 0 ? <FollowUpBadge /> : null}
              </div>
              <p className="font-medium">{quote.customerSnapshot.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatQuoteRoute(quote.pickupCity, quote.pickupState, quote.deliveryCity, quote.deliveryState)}
              </p>
              {showReasons && reasons.length > 0 ? (
                <p className="text-xs text-amber-800">{reasons.join(" · ")}</p>
              ) : null}
              {showActivityDate && quote.lastCustomerActionAt ? (
                <p className="text-xs text-muted-foreground">Last action {quote.lastCustomerActionAt.toLocaleDateString()}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold">{currency(quote.customerTotal.toString())}</p>
              <Link href={resolveLiveQuoteUrl(quote)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary">
                Live link
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "QUOTE_ACCEPTED") return <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600" />;
  if (type === "QUOTE_DECLINED") return <XCircle className="mt-0.5 h-4 w-4 text-red-600" />;
  return <HelpCircle className="mt-0.5 h-4 w-4 text-amber-600" />;
}
