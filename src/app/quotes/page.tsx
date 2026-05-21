import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { currency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({
    orderBy: { updatedAt: "desc" },
    include: { company: true, customerSnapshot: true, vehicles: true },
  });

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Draft, sent, and accepted quotes</p>
        <h2 className="text-3xl font-bold tracking-normal">Quote list</h2>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Quote</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Route</th>
              <th className="p-3">Vehicle</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-t">
                <td className="p-3 font-medium">{quote.quoteNumber}</td>
                <td className="p-3">{quote.customerSnapshot.name}</td>
                <td className="p-3">
                  {quote.pickupCity}, {quote.pickupState} to {quote.deliveryCity}, {quote.deliveryState}
                </td>
                <td className="p-3">
                  {quote.vehicles[0]?.year} {quote.vehicles[0]?.make} {quote.vehicles[0]?.model}
                </td>
                <td className="p-3">{currency(quote.customerTotal.toString())}</td>
                <td className="p-3">{quote.status}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="icon" variant="outline">
                      <Link href={`/quotes/${quote.id}/edit`} aria-label="Edit quote">
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="icon" variant="outline">
                      <Link href={`/quotes/${quote.id}/preview`} aria-label="Print preview">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!quotes.length && (
              <tr>
                <td className="p-6 text-muted-foreground" colSpan={7}>
                  No quotes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
