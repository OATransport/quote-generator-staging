export type CompanyContactInfo = {
  phone: string;
  email: string;
  website: string;
  websiteLabel: string;
};

const OAT_CONTACT: CompanyContactInfo = {
  phone: "(317)-743-2768",
  email: "info@shipwithoat.com",
  website: "https://www.shipwithoat.com/",
  websiteLabel: "shipwithoat.com",
};

const KEENER_CONTACT: CompanyContactInfo = {
  phone: "(317)-659-6719",
  email: "sales@keenerlogistics.com",
  website: "https://www.keenerlogistics.com/",
  websiteLabel: "keenerlogistics.com",
};

export function resolveCompanyContact(companyName: string): CompanyContactInfo | null {
  const normalized = companyName.toLowerCase();
  if (normalized.includes("keener")) return KEENER_CONTACT;
  if (normalized.includes("organized") || normalized.includes("oat")) return OAT_CONTACT;
  return null;
}

export function isKeenerCompany(companyName: string) {
  return companyName.toLowerCase().includes("keener");
}
