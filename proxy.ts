/**
 * Route protection (Next 16's replacement for middleware.ts).
 *
 * Signed-out visitors who open an app page are sent to the home page, which
 * shows the Google sign-in. API routes are left to their own checks so they
 * keep answering 401 JSON instead of redirecting.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPublicPath } from "@/lib/publicPaths";

export const proxy = auth((req) => {
  if (req.auth || isPublicPath(req.nextUrl.pathname)) return NextResponse.next();
  return NextResponse.redirect(new URL("/", req.nextUrl));
});

export const config = {
  // Everything except API routes, Next internals and files with an extension (images, icons).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
