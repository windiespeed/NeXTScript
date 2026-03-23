"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMobileMenu } from "@/context/MobileMenu";
import { useTheme } from "@/context/Theme";

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?")[0].toUpperCase();
}

function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full transition-colors hover:bg-[var(--bg-card-hover)]"
      style={{ color: "var(--text-secondary)" }}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export default function TopBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toggle } = useMobileMenu();
  const [query, setQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/user/settings")
        .then(r => r.json())
        .then(d => setAvatarUrl(d.avatarUrl ?? null))
        .catch(() => {});
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [mobileSearchOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
    setMobileSearchOpen(false);
  }

  const displaySrc = avatarUrl ?? session?.user?.image ?? null;
  const userInitials = initials(session?.user?.name, session?.user?.email);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Main bar */}
      <div className="h-16 flex items-center px-4">
        {/* Logo */}
        <div className="w-56 shrink-0">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="NeXTScript"
              width={160}
              height={44}
              className="h-11 w-auto dark:brightness-0 dark:invert"
              priority
            />
          </Link>
        </div>

        {/* Search bar — flex-centered between logo and actions */}
        <form onSubmit={handleSearch} className="hidden sm:flex flex-1 justify-center px-4 min-w-0">
          <div className="relative w-full max-w-sm">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              name="q"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search lessons, courses…"
              className="w-full pl-8 pr-3 py-1.5 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]"
              style={{
                background: "var(--bg-card-hover)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </form>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />

          {session && (
            <Link
              href="/profile"
              className="flex items-center gap-2.5 rounded-full px-2.5 py-1.5 transition hover:bg-[var(--bg-card-hover)]"
            >
              <div
                className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: "var(--accent-purple-bg)" }}
              >
                {displaySrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displaySrc} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold" style={{ color: "var(--accent-purple)" }}>
                    {userInitials}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium hidden md:block" style={{ color: "var(--text-primary)" }}>
                {session.user?.name?.split(" ")[0] ?? ""}
              </span>
            </Link>
          )}

          {/* Mobile search icon */}
          <button
            onClick={() => setMobileSearchOpen(v => !v)}
            className="sm:hidden p-2 rounded-full transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{ color: mobileSearchOpen ? "#0cc0df" : "var(--text-secondary)" }}
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={toggle}
            className="lg:hidden p-2 rounded-full transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile search bar — slides down when open */}
      {mobileSearchOpen && (
        <div className="sm:hidden px-4 pb-3">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={mobileInputRef}
                type="text"
                name="q"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search lessons, courses…"
                className="w-full pl-8 pr-3 py-2 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]"
                style={{
                  background: "var(--bg-card-hover)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
