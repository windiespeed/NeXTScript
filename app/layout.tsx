import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Sidebar from "@/components/Sidebar";
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
            <Sidebar />
            {/* Offset: top bar (64px) + floating sidebar (224px + 12px margin = 236px) */}
            <div className="lg:pl-[236px] pt-16 min-h-screen">
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
