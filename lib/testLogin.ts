import { timingSafeEqual } from "node:crypto";
import { isAllowedEmail } from "@/lib/emailDomain";

/**
 * Preview-only test login, so signed-in flows can be checked on Vercel preview
 * deployments without a person signing in with Google each time.
 *
 * It is ON only when both hold:
 *   - the app runs on a Vercel preview (VERCEL_ENV=preview) or `next dev`, never production;
 *   - TEST_LOGIN_SECRET is set (at least 24 characters).
 *
 * The test user is TEST_LOGIN_EMAIL (default test@nextscript.test) and must still pass
 * ALLOWED_EMAIL_DOMAINS. Without TEST_LOGIN_GOOGLE_REFRESH_TOKEN the user has no Google
 * access, so Drive/Slides/Classroom routes answer "No Google access token". With it set
 * (the refresh token of a dedicated test Google account), those routes work for real.
 */
export type TestLoginEnv = Partial<Record<
  "VERCEL_ENV" | "NODE_ENV" | "TEST_LOGIN_SECRET" | "TEST_LOGIN_EMAIL" | "TEST_LOGIN_GOOGLE_REFRESH_TOKEN" | "ALLOWED_EMAIL_DOMAINS",
  string
>>;

export const MIN_SECRET_LENGTH = 24;
export const DEFAULT_TEST_EMAIL = "test@nextscript.test";

export function isTestLoginEnabled(env: TestLoginEnv = process.env as TestLoginEnv): boolean {
  if (env.VERCEL_ENV === "production") return false;
  const nonProdHost = env.VERCEL_ENV === "preview" || (!env.VERCEL_ENV && env.NODE_ENV === "development");
  return nonProdHost && (env.TEST_LOGIN_SECRET ?? "").length >= MIN_SECRET_LENGTH;
}

export function testLoginEmail(env: TestLoginEnv = process.env as TestLoginEnv): string {
  return (env.TEST_LOGIN_EMAIL || DEFAULT_TEST_EMAIL).trim().toLowerCase();
}

/** Returns the test user when the secret matches and the test login is on, else null. */
export function authorizeTestLogin(
  secret: unknown,
  env: TestLoginEnv = process.env as TestLoginEnv,
): { id: string; email: string; name: string } | null {
  if (!isTestLoginEnabled(env) || typeof secret !== "string") return null;
  const a = Buffer.from(secret);
  const b = Buffer.from(env.TEST_LOGIN_SECRET!);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const email = testLoginEmail(env);
  if (!isAllowedEmail(email, env.ALLOWED_EMAIL_DOMAINS)) return null;
  return { id: `test-login:${email}`, email, name: "Test User" };
}
