import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import TopBar from "@/components/TopBar";
import { MobileMenuProvider } from "@/context/MobileMenu";
import { ThemeProvider } from "@/context/Theme";

const geist = Geist({ subsets: ["latin"] });

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
      <body className={`${geist.className} min-h-screen antialiased`} style={{ backgroundColor: "var(--bg-body)", color: "var(--text-primary)" }}>
        <Providers>
          <ThemeProvider>
          <MobileMenuProvider>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <TopBar />
            {/* MOCKUP: offset for top bar (64px) + menu bar on desktop (48px). Page content sits in a white container. */}
            <div className="pt-[76px] lg:pt-[112px] min-h-screen px-3 pb-3 sm:px-4 lg:px-6">
              <div className="mx-auto max-w-6xl rounded-3xl min-h-[calc(100dvh-88px)] lg:min-h-[calc(100dvh-124px)]" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
                <main id="main-content" tabIndex={-1} className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 focus:outline-none">
                  {children}
                </main>
              </div>
            </div>
          </MobileMenuProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
