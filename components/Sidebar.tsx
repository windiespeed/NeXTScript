"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMobileMenu } from "@/context/MobileMenu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-[#6366f1] text-white shadow-sm"
          : "hover:bg-[var(--bg-card-hover)]"
      }`}
      style={active ? {} : { color: "var(--text-secondary)" }}
    >
      <span className={`flex-shrink-0 ${active ? "text-white" : ""}`} style={active ? {} : { color: "var(--text-muted)" }}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

// Icons
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  courses: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  schedule: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  slides: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  forms: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  resources: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  profile: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
};

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/",         icon: Icons.dashboard },
  { label: "Courses",   href: "/courses",  icon: Icons.courses   },
  { label: "Schedule",  href: "/schedule", icon: Icons.schedule  },
];

const ASSETS_NAV: NavItem[] = [
  { label: "Slide Decks", href: "/slides",    icon: Icons.slides    },
  { label: "Forms",       href: "/forms",     icon: Icons.forms     },
  { label: "Resources",   href: "/resources", icon: Icons.resources },
];

const ACCOUNT_NAV: NavItem[] = [
  { label: "Profile", href: "/profile", icon: Icons.profile },
];

export default function Sidebar() {
  const { status } = useSession();
  const pathname = usePathname();
  const { open, close } = useMobileMenu();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      <div>
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>Main</p>
        <div className="space-y-0.5">
          {MAIN_NAV.map(item => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
        </div>
      </div>
      <div>
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>Assets</p>
        <div className="space-y-0.5">
          {ASSETS_NAV.map(item => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
        </div>
      </div>
      {status === "authenticated" && (
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>Account</p>
          <div className="space-y-0.5">
            {ACCOUNT_NAV.map(item => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
          </div>
        </div>
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — starts below top bar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 w-60 z-40"
        style={{
          top: "64px",
          height: "calc(100vh - 64px)",
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={close} />
          <aside
            className="lg:hidden fixed left-0 z-50 w-60 flex flex-col"
            style={{
              top: "64px",
              height: "calc(100vh - 64px)",
              background: "var(--bg-sidebar)",
              borderRight: "1px solid var(--border)",
            }}
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
