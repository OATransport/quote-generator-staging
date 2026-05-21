import { NextResponse } from "next/server";
import { lookupZip, normalizeZip } from "@/lib/zip-lookup";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip") ?? "";

  const normalized = normalizeZip(zip);
  if (!normalized) {
    return NextResponse.json({ error: "Enter a valid 5-digit ZIP code." }, { status: 400 });
  }

  const result = await lookupZip(normalized);
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result);
}
