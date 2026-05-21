import {
  formatPublicDepositValue,
  hasDepositDue,
  publicDepositHelperText,
  publicDepositLabel,
  type MoneyLike,
} from "@/lib/public-quote-deposit";
import { currency, cn } from "@/lib/utils";

type BreakdownItem = {
  id?: string;
  label: string;
  amount: { toString(): string } | number | string;
};

type PublicQuotePricingCardProps = {
  customerTotal: MoneyLike;
  depositDue: MoneyLike;
  balanceDue: MoneyLike;
  showItemizedBreakdown: boolean;
  breakdownItems: BreakdownItem[];
  description?: string;
  isKeener?: boolean;
};

export function PublicQuotePricingCard({
  customerTotal,
  depositDue,
  balanceDue,
  showItemizedBreakdown,
  breakdownItems,
  description,
  isKeener,
}: PublicQuotePricingCardProps) {
  const accent = isKeener ? "text-slate-900" : "text-sky-900";
  const cardBg = isKeener ? "bg-slate-50 ring-slate-200/80" : "bg-sky-50/80 ring-sky-200/80";
  const depositRequired = hasDepositDue(depositDue);

  return (
    <section className={cn("overflow-hidden rounded-2xl border-0 shadow-lg ring-2", cardBg)}>
      <div className="border-b border-black/[0.04] px-5 py-5 sm:px-7 sm:py-6">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Your transportation quote</h2>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
        {showItemizedBreakdown && breakdownItems.length > 0 ? (
          <div className="space-y-2">
            {breakdownItems.map((fee) => (
              <LineItem key={fee.id ?? fee.label} label={fee.label} value={currency(fee.amount.toString())} />
            ))}
            <TotalLine
              label="Transportation Service Total"
              value={currency(customerTotal.toString())}
              accent={accent}
            />
          </div>
        ) : (
          <TotalLine
            label="Vehicle Transportation Service"
            value={currency(customerTotal.toString())}
            accent={accent}
            large
          />
        )}

        <div className={cn("grid gap-3", depositRequired ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
          {depositRequired ? (
            <PaymentTile label={publicDepositLabel(depositDue)} value={formatPublicDepositValue(depositDue)} />
          ) : (
            <PaymentTile
              label="No Deposit Due Today"
              value="None required"
              subtle
            />
          )}
          <PaymentTile
            label="Balance Due on Delivery"
            value={currency(balanceDue.toString())}
            emphasis={!depositRequired}
          />
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{publicDepositHelperText(depositDue)}</p>
      </div>
    </section>
  );
}

function LineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/60 bg-white/70 px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function TotalLine({
  label,
  value,
  accent,
  large,
}: {
  label: string;
  value: string;
  accent?: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/80 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-bold tabular-nums tracking-tight", large ? cn("text-3xl sm:text-4xl", accent) : cn("text-2xl sm:text-3xl", accent))}>
        {value}
      </p>
    </div>
  );
}

function PaymentTile({
  label,
  value,
  emphasis,
  subtle,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-white px-4 py-4", emphasis ? "border-sky-200/80 shadow-sm" : "border-white/80")}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-bold tabular-nums",
          subtle ? "text-lg text-muted-foreground" : emphasis ? "text-2xl" : "text-xl",
        )}
      >
        {value}
      </p>
    </div>
  );
}
