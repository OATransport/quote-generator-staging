export function isBasicAuthEnabled() {
  return process.env.BASIC_AUTH_ENABLED?.trim().toLowerCase() === "true";
}

export function isPublicPath(pathname: string) {
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/accept/") || pathname === "/accept") return true;
  if (pathname.startsWith("/generated/")) return true;
  if (pathname.startsWith("/branding/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  return false;
}

export function isProtectedPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/import") return true;
  if (pathname === "/quotes" || pathname.startsWith("/quotes/")) return true;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return true;
  if (pathname.startsWith("/api/internal/")) return true;
  return false;
}

export function verifyBasicAuth(authorizationHeader: string | null, expectedUser: string, expectedPassword: string) {
  if (!authorizationHeader?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(authorizationHeader.slice(6));
    const separator = decoded.indexOf(":");
    if (separator === -1) return false;
    const user = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return user === expectedUser && password === expectedPassword;
  } catch {
    return false;
  }
}

export function basicAuthRealm() {
  return 'Basic realm="Quote Generator Staging"';
}
