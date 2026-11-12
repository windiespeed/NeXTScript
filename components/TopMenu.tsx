"use client";

// MOCKUP: the main menu as a horizontal bar under the top navbar, instead of the left sidebar.
// Desktop: one row of pills, Courses opens a dropdown of your courses, NeXTBox sits at the right end.
// Phone/tablet: the hamburger opens the same items as a slide-in panel.
// Profile/Settings moved to the account menu under your picture (TopBar).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMobileMenu } from "@/context/MobileMenu";
import Dialog from "@/components/ui/Dialog";

const icon = (d: React.ReactNode) => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const NAV = [
  { label: "Dashboard", href: "/", icon: icon(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>) },
  { label: "Courses", href: "/courses", icon: icon(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>) },
  { label: "Notes to Slides", href: "/ingest", icon: icon(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5L9 15M15 9l2.5-2.5"/></>) },
  { label: "Schedule", href: "/schedule", icon: icon(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>) },
  { label: "Resources", href: "/resources", icon: icon(<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>) },
];

const nextboxIcon = icon(<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M9 8l3 3-3 3"/><path d="M15 14h-3"/></>);

export default function TopMenu() {
  const pathname = usePathname();
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { open: mobileOpen, close } = useMobileMenu();

  useEffect(() => { setCoursesOpen(false); }, [pathname]);

  useEffect(() => {
    if (!coursesOpen) return;
    if (courses === null) {
      fetch("/api/courses").then(r => r.json()).then(d => setCourses(Array.isArray(d) ? d : [])).catch(() => setCourses([]));
    }
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setCoursesOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCoursesOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [coursesOpen, courses]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const pill = (active: boolean) =>
    `flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
      active ? "nav-active" : "hover:bg-[var(--bg-card-hover)]"
    }`;
  const pillStyle = (active: boolean) => (active ? {} : { color: "var(--text-secondary)" });

  return (
    <>
    <nav aria-label="Main" className="hidden lg:block" style={{ background: "var(--bg-sidebar)", borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-1 px-4 sm:px-6 lg:px-10">
        <div className="flex flex-1 items-center gap-1">
          {NAV.map(item => {
            const active = isActive(item.href);
            if (item.href === "/courses") {
              return (
                <div key={item.href} ref={wrapRef} className="relative flex items-center">
                  <Link href={item.href} className={`${pill(active)} pr-2`} style={pillStyle(active)}>
                    <span style={{ color: active ? "#ffffff" : "var(--text-muted)" }}>{item.icon}</span>
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCoursesOpen(o => !o)}
                    aria-label={coursesOpen ? "Hide your courses" : "Show your courses"}
                    aria-expanded={coursesOpen}
                    className="flex -ml-1 rounded-full p-1.5 transition hover:bg-[var(--bg-card-hover)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: coursesOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {coursesOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl p-2" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
                      <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>Your courses</p>
                      {courses === null && <p className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>Loading…</p>}
                      {courses?.length === 0 && <p className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>No courses yet</p>}
                      <div className="max-h-72 overflow-y-auto">
                        {courses?.map(c => {
                          const on = pathname.startsWith(`/courses/${c.id}`);
                          return (
                            <Link key={c.id} href={`/courses/${c.id}`} className="block truncate rounded-xl px-3 py-2 text-sm transition hover:bg-[var(--bg-card-hover)]"
                              style={{ color: on ? "#0cc0df" : "var(--text-secondary)", fontWeight: on ? 700 : 500 }}>
                              {c.title}
                            </Link>
                          );
                        })}
                      </div>
                      <Link href="/courses" className="mt-1 block rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]" style={{ color: "#0cc0df", borderTop: "1px solid var(--border)" }}>
                        All courses →
                      </Link>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={pill(active)} style={pillStyle(active)} aria-current={active ? "page" : undefined}>
                <span style={{ color: active ? "#ffffff" : "var(--text-muted)" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
        <span aria-disabled="true" className="flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium cursor-default" style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
          <span style={{ color: "var(--text-muted)" }}>{nextboxIcon}</span> NeXTBox
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>Coming soon</span>
        </span>
      </div>
    </nav>

    {/* Smaller screens: hamburger (in TopBar) opens this panel. */}
    <Dialog open={mobileOpen} onClose={close} placement="left" className="lg:hidden" labelledBy="mobile-menu-label">
      <nav aria-label="Main" className="flex h-full w-56 flex-col rounded-3xl px-3 py-4" style={{ background: "var(--bg-sidebar)" }}>
        <span id="mobile-menu-label" className="sr-only">Main menu</span>
        <div className="flex-1 space-y-1.5">
          {NAV.map(item => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className={`${pill(active)} w-full py-2`} style={pillStyle(active)} aria-current={active ? "page" : undefined}>
                <span style={{ color: active ? "#ffffff" : "var(--text-muted)" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
        <div aria-disabled="true" className="flex items-center gap-2 px-3.5 pt-3 pb-1 text-sm font-medium" style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>
          <span style={{ color: "var(--text-muted)" }}>{nextboxIcon}</span>
          <span className="flex-1">NeXTBox</span>
          <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>Coming soon</span>
        </div>
      </nav>
    </Dialog>
    </>
  );
}
