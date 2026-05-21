import { appUrl } from "@/lib/utils";

export function resolveBrandingAssetUrl(assetUrl?: string | null, absolute = false) {
  if (!assetUrl?.trim()) return undefined;
  const normalized = assetUrl.startsWith("/") ? assetUrl : `/${assetUrl}`;
  return absolute ? appUrl(normalized) : normalized;
}

export type CompanyBrandingFields = {
  name: string;
  legalName?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
};

export function companyDisplayName(company: Pick<CompanyBrandingFields, "name" | "legalName">) {
  return company.legalName?.trim() || company.name;
}

export function companyHeaderLogoUrl(company: CompanyBrandingFields) {
  return company.logoUrl ?? company.iconUrl ?? null;
}

export function companyCompactLogoUrl(company: CompanyBrandingFields) {
  return company.iconUrl ?? company.logoUrl ?? null;
}
