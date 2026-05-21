import type { Prisma, QuoteStatus } from "@prisma/client";

export type QuoteListSearchParams = {
  q?: string;
  company?: string;
  status?: string;
  source?: string;
  archived?: string;
  sort?: string;
};

export type QuoteSortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "status"
  | "company"
  | "customer";

export function parseArchivedFilter(archived?: string): "active" | "archived" | "all" {
  if (archived === "1") return "archived";
  if (archived === "all") return "all";
  return "active";
}

export function buildQuoteListWhere(params: QuoteListSearchParams): Prisma.QuoteWhereInput {
  const conditions: Prisma.QuoteWhereInput[] = [];
  const archived = parseArchivedFilter(params.archived);

  if (archived === "active") {
    conditions.push({ archivedAt: null });
  } else if (archived === "archived") {
    conditions.push({ archivedAt: { not: null } });
  }

  if (params.company === "oat") {
    conditions.push({ company: { name: { contains: "Organized", mode: "insensitive" } } });
  } else if (params.company === "keener") {
    conditions.push({ company: { name: { contains: "Keener", mode: "insensitive" } } });
  }

  if (params.status && params.status !== "all") {
    conditions.push({ status: params.status as QuoteStatus });
  }

  if (params.source === "ghl") {
    conditions.push({ ghlOpportunityId: { not: null } });
  } else if (params.source === "manual") {
    conditions.push({
      OR: [{ ghlOpportunityId: null }, { quoteNumber: { contains: "SAMPLE", mode: "insensitive" } }],
    });
  }

  const search = params.q?.trim();
  if (search) {
    conditions.push({
      OR: [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { customerSnapshot: { name: { contains: search, mode: "insensitive" } } },
        { customerSnapshot: { email: { contains: search, mode: "insensitive" } } },
        { customerSnapshot: { phone: { contains: search, mode: "insensitive" } } },
        { pickupCity: { contains: search, mode: "insensitive" } },
        { pickupState: { contains: search, mode: "insensitive" } },
        { deliveryCity: { contains: search, mode: "insensitive" } },
        { deliveryState: { contains: search, mode: "insensitive" } },
        {
          vehicles: {
            some: {
              OR: [
                { make: { contains: search, mode: "insensitive" } },
                { model: { contains: search, mode: "insensitive" } },
                { year: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

export function buildQuoteListOrderBy(sort?: string): Prisma.QuoteOrderByWithRelationInput {
  switch (sort as QuoteSortOption) {
    case "updated_asc":
      return { updatedAt: "asc" };
    case "created_desc":
      return { createdAt: "desc" };
    case "created_asc":
      return { createdAt: "asc" };
    case "status":
      return { status: "asc" };
    case "company":
      return { company: { name: "asc" } };
    case "customer":
      return { customerSnapshot: { name: "asc" } };
    case "updated_desc":
    default:
      return { updatedAt: "desc" };
  }
}

export function buildQuotesListUrl(params: QuoteListSearchParams) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.company && params.company !== "all") search.set("company", params.company);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.source && params.source !== "all") search.set("source", params.source);
  if (params.archived && params.archived !== "0") search.set("archived", params.archived);
  if (params.sort && params.sort !== "updated_desc") search.set("sort", params.sort);
  const query = search.toString();
  return query ? `/quotes?${query}` : "/quotes";
}

export function formatQuoteRoute(
  pickupCity: string | null,
  pickupState: string | null,
  deliveryCity: string | null,
  deliveryState: string | null,
) {
  const pickup = [pickupCity, pickupState].filter(Boolean).join(", ") || "Pickup TBD";
  const delivery = [deliveryCity, deliveryState].filter(Boolean).join(", ") || "Delivery TBD";
  return `${pickup} → ${delivery}`;
}

export function formatQuoteVehicle(vehicle?: {
  year?: string | null;
  make?: string | null;
  model?: string | null;
} | null) {
  const parts = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export const QUOTE_STATUS_OPTIONS = [
  "IMPORTED_FROM_GHL",
  "READY_TO_SEND",
  "SENT",
  "VIEWED",
  "QUESTION",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "DRAFT",
  "PDF_GENERATED",
  "SYNCED_TO_GHL",
] as const;
