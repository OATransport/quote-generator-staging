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
            variant === "compact" ? "text-sm" : "text-base",
          )}
        >
          {displayName}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <img
        src={resolvedLogo}
        alt={displayName}
        className={cn(
          "object-contain",
          variant === "public"
            ? "mx-auto h-24 w-auto max-w-[min(100%,320px)] object-center sm:h-28"
            : "object-left",
          variant === "header" ? "h-16 max-w-[260px]" : variant === "compact" ? "h-8 max-w-[160px]" : "",
        )}
      />
    </div>
  );
}
