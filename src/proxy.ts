import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Optimistic guard for the protected area. Pages under /app also call `auth()`
// themselves — never rely on the proxy alone (see Next.js data-security guide).
export const proxy = auth((req) => {
  if (!req.auth) {
    const signIn = new URL("/", req.nextUrl.origin);
    signIn.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
