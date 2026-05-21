import { chromium } from "playwright";
import type { QuoteWithRelations } from "@/lib/quote";
import { appUrl } from "@/lib/utils";
import { saveQuotePdfBuffer } from "@/lib/pdf-storage";

export { getPdfStorageMode, type PdfStorageMode } from "@/lib/pdf-storage";

export async function generateQuotePdf(quote: QuoteWithRelations) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(appUrl(`/quotes/${quote.id}/preview?print=1`), { waitUntil: "networkidle" });
  const pdfBuffer = await page.pdf({
    format: "Letter",
    printBackground: true,
    margin: { top: "0.4in", right: "0.4in", bottom: "0.4in", left: "0.4in" },
  });
  await browser.close();

  return saveQuotePdfBuffer(quote.quoteNumber, Buffer.from(pdfBuffer));
}
