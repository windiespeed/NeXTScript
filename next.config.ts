import type { NextConfig } from "next";

// Baseline security headers for every response. A full script-src CSP needs nonces
// for Next's inline scripts and the theme script in app/layout.tsx, so it's a later step.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Block other sites from framing the app (clickjacking). The public student view is
// left frameable in case the MCA LMS embeds it.
const noFramingHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // Classic Slides was retired in favor of Notes to Slides. Old bookmarks land on the closest
  // page that still exists. Temporary redirects, so they can be dropped later without browsers
  // having cached them.
  async redirects() {
    return [
      { source: "/slides", destination: "/lessons", permanent: false },
      { source: "/slides/new", destination: "/ingest", permanent: false },
      { source: "/slides/:id", destination: "/lessons/:id/edit", permanent: false },
      { source: "/courses/:id/batch-slides", destination: "/courses/:id", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/((?!courses/[^/]+/student).*)", headers: noFramingHeaders },
    ];
  },
};

export default nextConfig;
