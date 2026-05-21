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
            variant === "compact" ? "text-sm" : variant === "public" ? "text-lg tracking-wide" : "text-base",
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
        variant === "public" && "flex w-full items-center justify-center rounded-2xl bg-white/95 px-6 py-5 shadow-inner ring-1 ring-black/5",
        className,
      )}
    >
      <img
        src={resolvedLogo}
        alt={displayName}
        className={cn(
          "object-contain",
          variant === "public"
            ? "h-[72px] w-auto max-w-[min(100%,360px)] object-center sm:h-[88px]"
            : "object-left",
          variant === "header" ? "h-16 max-w-[260px]" : variant === "compact" ? "h-8 max-w-[160px]" : "",
        )}
      />
    </div>
  );
}
