import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import TopBar from "@/components/TopBar";
import { MobileMenuProvider } from "@/context/MobileMenu";
import { ThemeProvider } from "@/context/Theme";

// Geometric sans close to NeXT Central's font; swap for its exact font once known.
const font = Lexend({ subsets: ["latin"] });

export const metadata: Metadata = {
  // Each section's layout.tsx sets its own title, e.g. "Courses · NeXTScript" (WCAG 2.4.2).
  title: { default: "NeXTScript", template: "%s · NeXTScript" },
  description: "Build and export lesson bundles to Google Drive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}})()` }} />
      </head>
      <body className={`${font.className} min-h-screen antialiased`} style={{ backgroundColor: "var(--bg-body)", color: "var(--text-primary)" }}>
        <Providers>
          <ThemeProvider>
          <MobileMenuProvider>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <TopBar />
            {/* Offset: top bar (64px) + menu bar on desktop (48px), plus a gap before the content */}
            <div className="pt-16 lg:pt-[120px] min-h-screen">
              <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 focus:outline-none">
                {children}
              </main>
            </div>
          </MobileMenuProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
