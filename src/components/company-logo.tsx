import { companyDisplayName, resolveBrandingAssetUrl } from "@/lib/company-branding";
import { cn } from "@/lib/utils";

type CompanyLogoProps = {
  name: string;
  legalName?: string | null;
  logoUrl?: string | null;
  variant?: "header" | "compact" | "public";
  absoluteUrls?: boolean;
  className?: string;
};

export function CompanyLogo({
  name,
  legalName,
  logoUrl,
  variant = "header",
  absoluteUrls = false,
  className,
}: CompanyLogoProps) {
  const displayName = companyDisplayName({ name, legalName });
  const resolvedLogo = resolveBrandingAssetUrl(logoUrl, absoluteUrls);

  if (!resolvedLogo) {
    return (
      <div className={className}>
        <p
          className={cn(
            "font-semibold uppercase text-secondary",
            variant === "compact" ? "text-sm" : variant === "public" ? "text-xl tracking-wide text-white" : "text-base",
          )}
        >
          {displayName}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        variant === "public" &&
          "inline-flex max-w-full items-center rounded-xl bg-white/95 px-5 py-3 shadow-lg ring-1 ring-white/40 backdrop-blur-sm",
        className,
      )}
    >
      <img
        src={resolvedLogo}
        alt={displayName}
        className={cn(
          "object-contain",
          variant === "public"
            ? "h-[56px] w-auto max-w-[min(100%,280px)] object-left sm:h-[68px] sm:max-w-[320px]"
            : "object-left",
          variant === "header" ? "h-16 max-w-[260px]" : variant === "compact" ? "h-8 max-w-[160px]" : "",
        )}
      />
    </div>
  );
}
