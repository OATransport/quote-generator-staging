import { companyDisplayName, resolveBrandingAssetUrl } from "@/lib/company-branding";
import { cn } from "@/lib/utils";

type CompanyLogoProps = {
  name: string;
  legalName?: string | null;
  logoUrl?: string | null;
  variant?: "header" | "compact" | "public" | "public-hero";
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
            "font-semibold uppercase",
            variant === "compact"
              ? "text-sm text-secondary"
              : variant === "public" || variant === "public-hero"
                ? "text-lg tracking-wide text-white sm:text-xl"
                : "text-base text-secondary",
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
          "inline-flex max-w-full items-center rounded-xl bg-white/95 px-4 py-2.5 shadow-md ring-1 ring-white/40",
        variant === "public-hero" && "inline-flex max-w-full items-center rounded-lg bg-white px-3 py-2 shadow-md ring-1 ring-white/20",
        className,
      )}
    >
      <img
        src={resolvedLogo}
        alt={displayName}
        className={cn(
          "object-contain object-left",
          variant === "public-hero"
            ? "h-[44px] w-auto max-w-[200px] sm:h-[52px] sm:max-w-[240px]"
            : variant === "public"
              ? "h-[48px] w-auto max-w-[240px] sm:h-[56px]"
              : variant === "header"
                ? "h-16 max-w-[260px]"
                : variant === "compact"
                  ? "h-8 max-w-[160px]"
                  : "",
        )}
      />
    </div>
  );
}
