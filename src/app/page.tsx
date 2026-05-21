import Link from "next/link";
import { ArrowRight, FileText, Plug, Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [quoteCount, draftCount, acceptedCount, recentQuotes, recentNotifications] = await Promise.all([
    prisma.quote.count(),
    prisma.quote.count({ where: { status: "DRAFT" } }),
    prisma.quote.count({ where: { status: "ACCEPTED" } }),
    prisma.quote.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { customerSnapshot: true, company: true },
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        quote: { include: { customerSnapshot: true } },
      },
    }),
  ]);
  const accepted = await prisma.quote.aggregate({ where: { status: "ACCEPTED" }, _sum: { customerTotal: true } });

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">GoHighLevel quote add-on</p>
          <h2 className="text-3xl font-bold tracking-normal">Dashboard</h2>
        </div>
        <Button asChild>
          <Link href="/import">
            <Plug className="h-4 w-4" /> Import lead
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Total quotes" value={quoteCount} />
        <Stat title="Drafts" value={draftCount} />
        <Stat title="Accepted" value={acceptedCount} />
        <Stat title="Accepted revenue" value={currency(accepted._sum.customerTotal?.toString() ?? 0)} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent quotes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">Quote</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Company</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {recentQuotes.map((quote) => (
                    <tr key={quote.id} className="border-t">
                      <td className="p-3 font-medium">{quote.quoteNumber}</td>
                      <td className="p-3">{quote.customerSnapshot.name}</td>
                      <td className="p-3">{quote.company.name}</td>
                      <td className="p-3">{currency(quote.customerTotal.toString())}</td>
                      <td className="p-3">{quote.status}</td>
                      <td className="p-3 text-right">
                        <Link href={`/quotes/${quote.id}/edit`} className="inline-flex items-center gap-1 font-medium text-primary">
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!recentQuotes.length && (
                    <tr>
                      <td className="p-6 text-muted-foreground" colSpan={6}>
                        Import a GHL pipeline lead to create the first quote.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/settings/companies">
                <Settings className="h-4 w-4" /> Company settings
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/settings/ghl">
                <FileText className="h-4 w-4" /> GHL field mapping
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Message</th>
                  <th className="p-3">Quote</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Time</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {recentNotifications.map((notification) => (
                  <tr key={notification.id} className={`border-t ${notification.isRead ? "" : "bg-primary/5"}`}>
                    <td className="p-3">
                      <p className="font-medium">{notification.title}</p>
                      {!notification.isRead && <p className="text-xs text-primary">New</p>}
                    </td>
                    <td className="p-3 text-muted-foreground">{notification.message}</td>
                    <td className="p-3 font-medium">{notification.quote.quoteNumber}</td>
                    <td className="p-3">{notification.quote.customerSnapshot.name}</td>
                    <td className="p-3 text-muted-foreground">{notification.createdAt.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <Link href={`/quotes/${notification.quoteId}/edit`} className="inline-flex items-center gap-1 font-medium text-primary">
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!recentNotifications.length && (
                  <tr>
                    <td className="p-6 text-muted-foreground" colSpan={6}>
                      Customer accept, decline, and question responses will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-bold tracking-normal">{value}</p>
      </CardContent>
    </Card>
  );
}
