/**
 * Verify company logos on preview, acceptance pages, and generated PDFs.
 */
import { readFileSync, statSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { generateQuotePdf } from "@/lib/pdf";

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

async function pageContainsLogo(html: string, logoPath: string) {
  return html.includes(logoPath) || html.includes(encodeURI(logoPath));
}

async function main() {
  loadEnv();

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const prisma = new PrismaClient();

  const brandingFiles = [
    "public/branding/oat-logo.jpg",
    "public/branding/oat-icon.png",
    "public/branding/keener-logo.png",
    "public/branding/keener-icon.png",
  ];
  for (const file of brandingFiles) {
    statSync(resolve(process.cwd(), file));
  }

  const tests = [
    { quoteNumber: "Q-2026-00003", expectedLogo: "/branding/oat-logo.jpg", label: "OAT" },
    { quoteNumber: "Q-2026-00004", expectedLogo: "/branding/keener-logo.png", label: "Keener" },
  ] as const;

  const results = [];

  for (const test of tests) {
    const quote = await prisma.quote.findUnique({
      where: { quoteNumber: test.quoteNumber },
      include: { company: true, customerSnapshot: true, fees: true, vehicles: true },
    });
    if (!quote) throw new Error(`Quote not found: ${test.quoteNumber}`);

    const previewRes = await fetch(`${base}/quotes/${quote.id}/preview`);
    const previewHtml = await previewRes.text();
    const printPreviewRes = await fetch(`${base}/quotes/${quote.id}/preview?print=1`);
    const printPreviewHtml = await printPreviewRes.text();
    const acceptRes = await fetch(`${base}/accept/${quote.secureAccessToken}`);
    const acceptHtml = await acceptRes.text();

    const previewHasLogo = await pageContainsLogo(previewHtml, test.expectedLogo);
    const printPreviewHasAbsoluteLogo =
      printPreviewHtml.includes(`${base}${test.expectedLogo}`) ||
      printPreviewHtml.includes(`${base}${encodeURI(test.expectedLogo)}`);
    const acceptHasLogo = await pageContainsLogo(acceptHtml, test.expectedLogo);

    let pdfPath: string | null = null;
    let pdfGenerated = false;
    try {
      pdfPath = await generateQuotePdf(quote);
      pdfGenerated = statSync(resolve(process.cwd(), "public", pdfPath.replace(/^\//, ""))).size > 0;
    } catch (error) {
      pdfPath = error instanceof Error ? error.message : "PDF generation failed";
    }

    results.push({
      label: test.label,
      quoteNumber: test.quoteNumber,
      companyLogoUrl: quote.company.logoUrl,
      companyIconUrl: quote.company.iconUrl,
      previewStatus: previewRes.status,
      previewHasLogo,
      printPreviewHasAbsoluteLogo,
      acceptStatus: acceptRes.status,
      acceptHasLogo,
      pdfPath,
      pdfGenerated,
    });
  }

  await prisma.$disconnect();

  console.log(JSON.stringify({ base, results }, null, 2));

  for (const result of results) {
    if (!result.previewHasLogo || !result.acceptHasLogo || !result.printPreviewHasAbsoluteLogo) {
      throw new Error(`${result.label} logo missing from preview or acceptance page.`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
