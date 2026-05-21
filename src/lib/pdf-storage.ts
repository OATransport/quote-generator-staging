import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

export type PdfStorageMode = "local" | "vercel-blob";

export function getPdfStorageMode(): PdfStorageMode {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "vercel-blob" : "local";
}

export function quotePdfBlobPath(quoteNumber: string) {
  return `quotes/${quoteNumber}.pdf`;
}

export async function saveQuotePdfBuffer(quoteNumber: string, pdfBuffer: Buffer) {
  if (getPdfStorageMode() === "vercel-blob") {
    const blob = await put(quotePdfBlobPath(quoteNumber), pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "generated", "quotes");
  await mkdir(dir, { recursive: true });
  const fileName = `${quoteNumber}.pdf`;
  await writeFile(path.join(dir, fileName), pdfBuffer);
  return `/generated/quotes/${fileName}`;
}
