/**
 * Verify Basic Auth path rules and optional live HTTP checks (no GHL writes).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  isProtectedPath,
  isPublicPath,
  verifyBasicAuth,
} from "@/lib/basic-auth";

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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function resolveBaseUrl() {
  for (const url of ["http://localhost:3000", "http://localhost:3001"]) {
    try {
      if ((await fetch(`${url}/`).then((r) => r.status)) !== 0) return url;
    } catch {
      // try next
    }
  }
  return null;
}

function assertPathRules() {
  const publicPaths = [
    "/accept/test-accept-token",
    "/generated/quotes/Q-1.pdf",
    "/branding/oat-logo.jpg",
    "/favicon.ico",
    "/_next/static/chunk.js",
  ];
  const protectedPaths = ["/", "/import", "/quotes", "/quotes/abc/edit", "/dashboard", "/dashboard/import-ghl", "/settings/ghl", "/api/internal/health"];

  for (const path of publicPaths) {
    if (!isPublicPath(path)) throw new Error(`Expected public: ${path}`);
  }
  for (const path of protectedPaths) {
    if (!isProtectedPath(path)) throw new Error(`Expected protected: ${path}`);
  }
  if (isProtectedPath("/accept/foo")) throw new Error("/accept should not be protected");
  if (isPublicPath("/quotes")) throw new Error("/quotes should not be public");

  if (!verifyBasicAuth("Basic " + Buffer.from("staging-user:staging-pass").toString("base64"), "staging-user", "staging-pass")) {
    throw new Error("verifyBasicAuth should accept valid credentials");
  }
  if (verifyBasicAuth("Basic invalid", "staging-user", "staging-pass")) {
    throw new Error("verifyBasicAuth should reject invalid credentials");
  }
}

async function main() {
  loadEnv();
  assertPathRules();
  console.log("PASS — path rules and credential parsing");

  const base = await resolveBaseUrl();
  if (!base) {
    console.log("SKIP — HTTP checks (dev server not running). Start with BASIC_AUTH_ENABLED=true npm run dev");
    return;
  }

  const enabled = process.env.BASIC_AUTH_ENABLED?.trim().toLowerCase() === "true";
  const user = process.env.BASIC_AUTH_USER ?? "";
  const password = process.env.BASIC_AUTH_PASSWORD ?? "";
  const authHeaders: HeadersInit | undefined =
    user && password
      ? { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` }
      : undefined;

  const internalNoAuth = await fetch(`${base}/`);
  const acceptNoAuth = await fetch(`${base}/accept/test-accept-token`);
  const brandingNoAuth = await fetch(`${base}/branding/oat-logo.jpg`);

  console.log("HTTP (no auth)", {
    enabled,
    internalStatus: internalNoAuth.status,
    acceptStatus: acceptNoAuth.status,
    brandingStatus: brandingNoAuth.status,
  });

  if (enabled) {
    if (internalNoAuth.status !== 401) throw new Error(`Expected 401 on / without auth, got ${internalNoAuth.status}`);
    if (acceptNoAuth.status !== 200) throw new Error(`Expected 200 on /accept without auth, got ${acceptNoAuth.status}`);
    if (brandingNoAuth.status !== 200) throw new Error(`Expected 200 on /branding without auth, got ${brandingNoAuth.status}`);

    const internalWithAuth = await fetch(`${base}/`, { headers: authHeaders });
    if (internalWithAuth.status !== 200) {
      throw new Error(`Expected 200 on / with auth when enabled, got ${internalWithAuth.status}`);
    }
    console.log("PASS — HTTP checks with BASIC_AUTH_ENABLED=true");
  } else {
    if (internalNoAuth.status !== 200) throw new Error(`Expected 200 on / when auth disabled, got ${internalNoAuth.status}`);
    console.log("PASS — HTTP checks with BASIC_AUTH_ENABLED=false");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
