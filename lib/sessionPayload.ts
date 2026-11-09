/** Fields the session callback adds for server code that must never reach the browser. */
const SERVER_ONLY_SESSION_FIELDS = ["accessToken"] as const;

/**
 * Removes server-only fields from a session payload. The Google access token
 * carries full Drive scope, so it stays on the server: any script running in the
 * page could otherwise read it from /api/auth/session.
 */
export function stripServerOnlyFields(session: unknown): unknown {
  if (!session || typeof session !== "object") return session;
  const copy: Record<string, unknown> = { ...(session as Record<string, unknown>) };
  for (const key of SERVER_ONLY_SESSION_FIELDS) delete copy[key];
  return copy;
}
