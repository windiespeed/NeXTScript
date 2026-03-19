import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { MobileMenuProvider } from "@/context/MobileMenu";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NeXTScript",
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
          <MobileMenuProvider>
            <TopBar />
            <Sidebar />
            {/* Offset: top bar (64px) + left sidebar (240px on desktop) */}
            <div className="lg:pl-60 pt-16 min-h-screen">
              <main className="mx-auto max-w-5xl px-6 py-8">
                {children}
              </main>
            </div>
          </MobileMenuProvider>
        </Providers>
      </body>
    </html>
  );
}
