import { NextResponse } from "next/server";

/**
 * 500 response for an unexpected error. The details go to the server log
 * (Vercel function logs); the browser gets a generic message so Firestore,
 * Google API or stack details never leak to the client.
 */
export function serverError(err: unknown, context?: string): NextResponse {
  console.error(context ? `[api] ${context}:` : "[api]", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
