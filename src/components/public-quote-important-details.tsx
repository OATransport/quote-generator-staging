import { CalendarClock, CircleDollarSign, Info, MessageCircle, Truck } from "lucide-react";
import { buildPublicQuoteTerms } from "@/lib/public-quote-terms";
import type { MoneyLike } from "@/lib/public-quote-deposit";

type PublicQuoteImportantDetailsProps = {
  quoteMode: string;
  companyName: string;
  hasExpiration: boolean;
  depositDue: MoneyLike;
};

const termIcons = [CircleDollarSign, Truck, CalendarClock, Info, MessageCircle] as const;

export function PublicQuoteImportantDetails({
  quoteMode,
  companyName,
  hasExpiration,
  depositDue,
}: PublicQuoteImportantDetailsProps) {
  const terms = buildPublicQuoteTerms({ quoteMode, companyName, hasExpiration, depositDue });

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Important details</h2>
      </div>
      <ul className="mt-4 space-y-3">
        {terms.map((term, index) => {
          const Icon = termIcons[index % termIcons.length];
          return (
            <li key={term} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>{term}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
