import { ArrowRight, Minus } from "lucide-react";
import { currency } from "@/lib/utils";

export function QuotePricingFormula({
  customerPrice,
  carrierPay,
  brokerFee,
}: {
  customerPrice: number;
  carrierPay: number;
  brokerFee: number;
}) {
  return (
    <div className="rounded-xl border bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing relationship</p>
      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
        <FormulaTile label="Customer price" value={currency(customerPrice)} emphasis />
        <Minus className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
        <FormulaTile label="Carrier pay" value={currency(carrierPay)} />
        <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground sm:block" />
        <FormulaTile label="Broker fee / gross profit" value={currency(brokerFee)} emphasis accent />
      </div>
    </div>
  );
}

function FormulaTile({
  label,
  value,
  emphasis,
  accent,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[140px] rounded-lg border bg-background px-4 py-3 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-bold ${emphasis ? "text-2xl" : "text-xl"} ${accent ? "text-emerald-700" : ""}`}>{value}</p>
    </div>
  );
}
