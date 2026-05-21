/**
 * Verify live-link-first workflow: public pages work without PDF (no real GHL writes).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { resolveLiveQuoteUrl } from "@/lib/live-quote-url";

function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function resolveBaseUrl() {
  for (const url of [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", "http://localhost:3000"]) {
    try {
      if ((await fetch(`${url}/`).then((r) => r.status)) === 200) return url;
    } catch {
      // try next
    }
  }
  return null;
}

async function main() {
  loadEnv();

  const prisma = new PrismaClient();
  const base = await resolveBaseUrl();
  if (!base) throw new Error("Dev server not running. Start with: npm run dev");

  const tests = [
    { quoteNumber: "Q-2026-00003", label: "OAT" },
    { quoteNumber: "Q-2026-00004", label: "Keener" },
  ] as const;

  const results = [];

  for (const test of tests) {
    const quote = await prisma.quote.findUnique({ where: { quoteNumber: test.quoteNumber } });
    if (!quote) throw new Error(`Quote not found: ${test.quoteNumber}`);

    const savedPdfUrl = quote.quotePdfUrl;
    await prisma.quote.update({ where: { id: quote.id }, data: { quotePdfUrl: null } });

    const liveQuoteUrl = resolveLiveQuoteUrl(quote);
    const response = await fetch(`${base}/accept/${quote.secureAccessToken}`);
    const html = await response.text();

    await prisma.quote.update({ where: { id: quote.id }, data: { quotePdfUrl: savedPdfUrl } });

    results.push({
      label: test.label,
      quoteNumber: test.quoteNumber,
      liveQuoteUrl,
      publicPageStatus: response.status,
      publicPageLoads: response.status === 200,
      hasAcceptForm: html.includes("Accept quote"),
      hasDeclineForm: html.includes("Decline quote"),
      hasQuestionForm: html.includes("Ask a question"),
      showsPdfButton: html.includes("Download PDF copy"),
      liveUrlUsesAcceptPath: liveQuoteUrl.includes("/accept/"),
    });
  }

  await prisma.$disconnect();

  console.log(JSON.stringify({ base, results }, null, 2));

  for (const row of results) {
    if (!row.publicPageLoads || !row.hasAcceptForm || !row.hasDeclineForm || !row.hasQuestionForm) {
      throw new Error(`${row.label}: public live quote page missing required sections.`);
    }
    if (row.showsPdfButton) {
      throw new Error(`${row.label}: PDF button should be hidden when quotePdfUrl is null.`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
