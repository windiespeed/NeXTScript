/** Pages anyone may open without signing in. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  // Read-only student view of a course, backed by /api/public/courses/[id].
  if (/^\/courses\/[^/]+\/student\/?$/.test(pathname)) return true;
  return false;
}
