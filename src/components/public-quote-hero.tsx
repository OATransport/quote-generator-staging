import Link from "next/link";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { companyDisplayName } from "@/lib/company-branding";
import { cn } from "@/lib/utils";

type PublicQuoteHeroProps = {
  companyName: string;
  legalName?: string | null;
  logoUrl?: string | null;
  quoteNumber: string;
  customerName: string;
  status: string;
  validUntil?: Date | null;
  isKeener?: boolean;
  accepted?: boolean;
  declined?: boolean;
  contact?: {
    phone: string;
    email: string;
    website: string;
    websiteLabel: string;
  } | null;
};

export function PublicQuoteHero({
  companyName,
  legalName,
  logoUrl,
  quoteNumber,
  customerName,
  status,
  validUntil,
  isKeener,
  accepted,
  declined,
  contact,
}: PublicQuoteHeroProps) {
  const brandGradient = isKeener ? "from-slate-950 via-slate-900 to-slate-800" : "from-sky-950 via-sky-900 to-blue-900";
  const displayName = companyDisplayName({ name: companyName, legalName });

  return (
    <header className={cn("relative overflow-hidden px-5 py-8 text-white sm:px-8 sm:py-10", `bg-gradient-to-br ${brandGradient}`)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_45%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <CompanyLogo
              name={companyName}
              legalName={legalName}
              logoUrl={logoUrl}
              variant="public-hero"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight sm:text-lg">{displayName}</p>
              <p className="mt-0.5 text-sm text-white/75">Vehicle transportation quote</p>
            </div>
          </div>

          {contact ? (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
              <ContactLink icon={Phone} href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} label={contact.phone} />
              <ContactLink icon={Mail} href={`mailto:${contact.email}`} label={contact.email} />
            </div>
          ) : null}
        </div>

        <div className="space-y-4 lg:text-right">
          <StatusPill status={status} accepted={accepted} declined={declined} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Quote number</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{quoteNumber}</h1>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Prepared for</p>
            <p className="mt-1 text-lg font-medium text-white/95">{customerName}</p>
          </div>
          {validUntil ? (
            <p className="text-sm text-white/75">
              Valid until {validUntil.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          ) : null}
          {contact ? (
            <div className="hidden lg:block">
              <ContactLink icon={ShieldCheck} href={contact.website} label={contact.websiteLabel} external />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ContactLink({
  icon: Icon,
  href,
  label,
  external,
}: {
  icon: typeof Phone;
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-2 transition hover:text-white"
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span>{label}</span>
    </Link>
  );
}

function StatusPill({ status, accepted, declined }: { status: string; accepted?: boolean; declined?: boolean }) {
  const label = accepted ? "Accepted" : declined ? "Declined" : status.replaceAll("_", " ");
  const styles = accepted
    ? "bg-emerald-500/25 text-emerald-100 ring-emerald-400/30"
    : declined
      ? "bg-red-500/25 text-red-100 ring-red-400/30"
      : "bg-white/15 text-white ring-white/20";
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1", styles)}>
      {label}
    </span>
  );
}
