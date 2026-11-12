"use client";

import Image from "next/image";
import TopMenu from "@/components/TopMenu";
import Avatar, { AVATAR_CHANGED_EVENT } from "@/components/Avatar";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMobileMenu } from "@/context/MobileMenu";
import { useTheme } from "@/context/Theme";

function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full transition-colors hover:bg-[var(--bg-card-hover)]"
      style={{ color: "var(--text-secondary)" }}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

// Profile/Settings and Sign out live in a menu under your picture and name (top right).
function AccountMenu({ name, email, sources }: { name?: string | null; email?: string | null; sources: (string | null | undefined)[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) { setLastPath(pathname); setOpen(false); }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-left transition hover:bg-[var(--bg-card-hover)]";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2.5 rounded-full px-2.5 py-1.5 transition hover:bg-[var(--bg-card-hover)]"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "var(--accent-purple-bg)" }}>
          <Avatar sources={sources} name={name} email={email} initialsClassName="text-xs font-bold" initialsStyle={{ color: "var(--accent-purple)" }} />
        </div>
        <span className="text-sm font-medium hidden md:block" style={{ color: "var(--text-primary)" }}>{name?.split(" ")[0] ?? ""}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="hidden md:block" style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl p-2" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
          <div className="px-3 pb-2 pt-1" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{name}</p>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{email}</p>
          </div>
          <div className="pt-1">
            <Link role="menuitem" href="/profile" className={item} style={{ color: "var(--text-secondary)" }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>
              Profile &amp; settings
            </Link>
            <button role="menuitem" type="button" onClick={() => signOut({ callbackUrl: "/" })} className={item} style={{ color: "var(--text-secondary)" }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { open: menuOpen, toggle } = useMobileMenu();
  const [query, setQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.user?.email) return;
    const load = () => {
      fetch("/api/user/settings")
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d) setAvatarUrl(d.avatarUrl ?? null); })
        .catch(() => {});
    };
    load();
    // The profile page announces photo uploads and removals so this updates without a reload.
    const onChange = (e: Event) => setAvatarUrl((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener(AVATAR_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AVATAR_CHANGED_EVENT, onChange);
  }, [session?.user?.email]);

  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [mobileSearchOpen]);

  // Clear the box when leaving the results page (it keeps the typed search while on it).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (pathname !== "/search") setQuery("");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setMobileSearchOpen(false);
  }


  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Main bar */}
      <div className="h-16 flex items-center px-4">
        {/* Logo */}
        <div className="shrink-0 lg:w-56">
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
        <form role="search" onSubmit={handleSearch} className="hidden sm:flex flex-1 justify-center px-4 min-w-0">
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
              type="search"
              name="q"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search lessons, courses…"
              aria-label="Search lessons and courses"
              className="w-full pl-8 pr-3 py-1.5 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]"
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

          {session && <AccountMenu name={session.user?.name} email={session.user?.email} sources={[avatarUrl, session.user?.image]} />}

          {/* Mobile search icon */}
          <button
            onClick={() => setMobileSearchOpen(v => !v)}
            className="sm:hidden p-2 rounded-full transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{ color: mobileSearchOpen ? "#0cc0df" : "var(--text-secondary)" }}
            aria-label="Search"
            aria-expanded={mobileSearchOpen}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={toggle}
            className="lg:hidden p-2 rounded-full transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{ color: "var(--text-secondary)" }}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main menu: a horizontal bar under the navbar on desktop; the hamburger panel on smaller screens */}
      <TopMenu />

      {/* Mobile search bar — slides down when open */}
      {mobileSearchOpen && (
        <div className="sm:hidden px-4 pb-3">
          <form role="search" onSubmit={handleSearch}>
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
                type="search"
                name="q"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search lessons, courses…"
                aria-label="Search lessons and courses"
                className="w-full pl-8 pr-3 py-2 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]"
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
