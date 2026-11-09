/**
 * Email domains allowed to sign in, from ALLOWED_EMAIL_DOMAINS (comma-separated,
 * e.g. "example.org"). When unset, any Google account may sign in, so
 * setting it in Vercel is what turns the restriction on. This backs up Google's
 * own block once the OAuth app is set to Internal.
 */
export function isAllowedEmail(email: string | null | undefined, allowed = process.env.ALLOWED_EMAIL_DOMAINS): boolean {
  const domains = (allowed ?? "").split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  if (domains.length === 0) return true;
  const domain = email?.toLowerCase().split("@")[1];
  return !!domain && domains.includes(domain);
}
