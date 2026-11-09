import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { stripServerOnlyFields } from "@/lib/sessionPayload";

export const { POST } = handlers;

/** Same as NextAuth's GET handler, but the session payload has the Google token removed. */
export async function GET(req: NextRequest) {
  const res = await handlers.GET(req);
  if (!req.nextUrl.pathname.endsWith("/session") || !res.headers.get("content-type")?.includes("application/json")) {
    return res;
  }
  const body = stripServerOnlyFields(await res.json());
  // Keep the original headers: a session read can rotate the session cookie.
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(body), { status: res.status, statusText: res.statusText, headers });
}
