import { headers } from "next/headers";

export async function getRequestMeta() {
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || undefined;
    const userAgent = headerList.get("user-agent") || undefined;
    return { ip, userAgent };
  } catch {
    return { ip: undefined, userAgent: undefined };
  }
}
