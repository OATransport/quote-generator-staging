import { NextResponse, type NextRequest } from "next/server";
import {
  basicAuthRealm,
  isBasicAuthEnabled,
  isProtectedPath,
  isPublicPath,
  verifyBasicAuth,
} from "@/lib/basic-auth";

export function middleware(request: NextRequest) {
  if (!isBasicAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const user = process.env.BASIC_AUTH_USER?.trim() ?? "";
  const password = process.env.BASIC_AUTH_PASSWORD?.trim() ?? "";

  if (!user || !password) {
    return unauthorized();
  }

  if (verifyBasicAuth(request.headers.get("authorization"), user, password)) {
    return NextResponse.next();
  }

  return unauthorized();
}

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": basicAuthRealm(),
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
