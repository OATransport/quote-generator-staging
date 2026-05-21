import type { QuoteMode, QuoteStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

const QUOTE_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "IMPORTED_FROM_GHL",
  "READY_TO_SEND",
  "PDF_GENERATED",
  "SYNCED_TO_GHL",
  "SENT",
  "VIEWED",
  "QUESTION",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CONVERTED",
  "CANCELLED",
];

const QUOTE_MODES: QuoteMode[] = ["OAT_DIRECT", "KEENER_LOGISTICS", "OAT_IF_BROKERED"];

export function parseMoney(value: FormDataEntryValue | null | undefined, fallback = 0) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toDecimal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value);
}

export function parseQuoteStatus(value: FormDataEntryValue | null | undefined, fallback: QuoteStatus): QuoteStatus {
  const text = String(value ?? "").trim();
  return (QUOTE_STATUSES as string[]).includes(text) ? (text as QuoteStatus) : fallback;
}

export function parseQuoteMode(value: FormDataEntryValue | null | undefined, fallback: QuoteMode): QuoteMode {
  const text = String(value ?? "").trim();
  return (QUOTE_MODES as string[]).includes(text) ? (text as QuoteMode) : fallback;
}

export const quoteStatusOptions = QUOTE_STATUSES;
