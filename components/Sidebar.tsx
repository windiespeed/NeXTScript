"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMobileMenu } from "@/context/MobileMenu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
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
  quizzes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  schedule: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
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

const DEFAULT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/",          icon: Icons.dashboard },
  { label: "Courses",   href: "/courses",   icon: Icons.courses   },
  { label: "Quizzes",   href: "/quizzes",   icon: Icons.quizzes   },
  { label: "Schedule",  href: "/schedule",  icon: Icons.schedule  },
  { label: "Resources", href: "/resources", icon: Icons.resources },
  { label: "Profile",   href: "/profile",   icon: Icons.profile   },
];

const STORAGE_KEY = "sidebar-nav-order";

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveOrder(hrefs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hrefs));
  } catch {}
}

function applyOrder(saved: string[]): NavItem[] {
  const map = Object.fromEntries(DEFAULT_NAV.map(n => [n.href, n]));
  const ordered = saved.map(h => map[h]).filter(Boolean);
  // Append any new items not yet in saved order
  DEFAULT_NAV.forEach(n => { if (!saved.includes(n.href)) ordered.push(n); });
  return ordered;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { open, close } = useMobileMenu();

  const [nav, setNav] = useState<NavItem[]>(DEFAULT_NAV);
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    const saved = loadOrder();
    if (saved) setNav(applyOrder(saved));
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function onDragStart(i: number) {
    dragIndex.current = i;
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOver(i);
  }

  function onDrop(i: number) {
    const from = dragIndex.current;
    if (from === null || from === i) { setDragOver(null); return; }
    const next = [...nav];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    setNav(next);
    saveOrder(next.map(n => n.href));
    dragIndex.current = null;
    setDragOver(null);
  }

  function onDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

  const sidebarContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-1.5">
        {nav.map((item, i) => (
          <div
            key={item.href}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={() => onDrop(i)}
            onDragEnd={onDragEnd}
            className={`group relative transition-all duration-150 ${dragOver === i ? "opacity-50" : ""}`}
          >
            <Link
              href={item.href}
              className={`flex items-center gap-3 pl-3 pr-8 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                isActive(item.href)
                  ? "bg-[#0cc0df] text-[#0a0b13] shadow-sm"
                  : "hover:bg-[var(--bg-card-hover)]"
              }`}
              style={isActive(item.href) ? {} : { color: "var(--text-secondary)", border: "1px solid var(--border)", background: "var(--bg-card)" }}
            >
              <span className={`flex-shrink-0`} style={isActive(item.href) ? { color: "#0a0b13" } : { color: "var(--text-muted)" }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
            {/* Drag handle — visible on hover */}
            <div
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              style={{ color: "var(--text-muted)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — floats below top bar with margin */}
      <aside
        className="hidden lg:flex flex-col fixed left-3 z-40 rounded-3xl w-56"
        style={{
          top: "76px",
          height: "calc(100vh - 88px)",
          background: "var(--bg-sidebar)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={close} />
          <aside
            className="lg:hidden fixed left-3 z-50 w-56 flex flex-col rounded-3xl"
            style={{
              top: "76px",
              height: "calc(100vh - 88px)",
              background: "var(--bg-sidebar)",
            }}
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
