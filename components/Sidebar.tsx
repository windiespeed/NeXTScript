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

interface SidebarCourse {
  id: string;
  name: string;
  moduleGroups: { id: string; title: string; lessonIds: string[] }[];
}

interface SidebarLesson {
  id: string;
  title: string;
}

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
  classes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
  { label: "Schedule",  href: "/schedule",  icon: Icons.schedule  },
  { label: "Resources", href: "/resources", icon: Icons.resources },
  { label: "Profile",   href: "/profile",   icon: Icons.profile   },
];

const STORAGE_KEY = "sidebar-nav-order";

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveOrder(hrefs: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(hrefs)); } catch {}
}

function applyOrder(saved: string[]): NavItem[] {
  const map = Object.fromEntries(DEFAULT_NAV.map(n => [n.href, n]));
  const ordered = saved.map(h => map[h]).filter(Boolean);
  DEFAULT_NAV.forEach(n => { if (!saved.includes(n.href)) ordered.push(n); });
  return ordered;
}

const chevronSVG = (open: boolean) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    className="transition-transform duration-200" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const gripSVG = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
  </svg>
);

const nextboxIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
    <path d="M9 8l3 3-3 3"/><path d="M15 14h-3"/>
  </svg>
);

export default function Sidebar() {
  const pathname = usePathname();
  const { open, close } = useMobileMenu();

  const [nav, setNav] = useState<NavItem[]>(DEFAULT_NAV);
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const [sidebarCourses, setSidebarCourses] = useState<SidebarCourse[]>([]);
  const [sidebarLessons, setSidebarLessons] = useState<SidebarLesson[]>([]);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(new Set());
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = loadOrder();
    if (saved) setNav(applyOrder(saved));
  }, []);

  // Auto-open and fetch when on course or module routes
  useEffect(() => {
    if (!pathname.startsWith("/courses") && !pathname.startsWith("/modules")) return;
    setCoursesOpen(true);
    Promise.all([
      fetch("/api/courses").then(r => r.json()),
      fetch("/api/lessons").then(r => r.json()),
    ]).then(([courseData, lessonData]) => {
      if (Array.isArray(lessonData)) {
        setSidebarLessons(lessonData.map((l: { id: string; title: string }) => ({ id: l.id, title: l.title })));
      }
      if (!Array.isArray(courseData)) return;
      const courses: SidebarCourse[] = courseData.map((c: { id: string; title: string; modules?: { id: string; title: string; lessonIds?: string[] }[] }) => ({
        id: c.id,
        name: c.title,
        moduleGroups: Array.isArray(c.modules) ? c.modules.map(m => ({ id: m.id, title: m.title, lessonIds: m.lessonIds ?? [] })) : [],
      }));
      setSidebarCourses(courses);
      // Auto-expand the active course
      const activeCourse = courses.find(c => pathname.startsWith(`/courses/${c.id}`));
      if (activeCourse && activeCourse.moduleGroups.length > 0) {
        setExpandedCourseIds(prev => new Set([...prev, activeCourse.id]));
      }
    }).catch(() => {});
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function onDragStart(i: number) { dragIndex.current = i; }
  function onDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDragOver(i); }
  function onDragEnd() { dragIndex.current = null; setDragOver(null); }

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

  function renderCoursesItem(item: NavItem, i: number) {
    const active = isActive(item.href);
    return (
      <div
        key={item.href}
        draggable
        onDragStart={() => onDragStart(i)}
        onDragOver={(e) => onDragOver(e, i)}
        onDrop={() => onDrop(i)}
        onDragEnd={onDragEnd}
        className={`transition-all duration-150 ${dragOver === i ? "opacity-50" : ""}`}
      >
        {/* Courses row */}
        <div className="group flex items-center">
          <Link
            href={item.href}
            className={`flex items-center gap-3 pl-3 py-2 rounded-full text-sm font-medium transition-all duration-150 flex-1 min-w-0 ${
              active ? "bg-[#0cc0df] text-[#0a0b13] shadow-sm" : "hover:bg-[var(--bg-card-hover)]"
            }`}
            style={active ? {} : { color: "var(--text-secondary)" }}
          >
            <span className="flex-shrink-0" style={active ? { color: "#0a0b13" } : { color: "var(--text-muted)" }}>
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
          <div
            className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            style={{ color: "var(--text-muted)" }}
          >
            {gripSVG}
          </div>
          <button
            onClick={() => setCoursesOpen(o => !o)}
            className="flex-shrink-0 p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)] mr-1"
            style={{ color: active ? "#0a0b13" : "var(--text-muted)" }}
          >
            {chevronSVG(coursesOpen)}
          </button>
        </div>

        {/* Courses sub-menu */}
        {coursesOpen && (
          <div className="mt-0.5 space-y-0.5 pl-2">
            {sidebarCourses.length === 0 && (
              <p className="pl-3 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>No courses yet</p>
            )}
            {sidebarCourses.map(course => {
              const courseActive = pathname.startsWith(`/courses/${course.id}`);
              const courseExpanded = expandedCourseIds.has(course.id);
              const hasModules = course.moduleGroups.length > 0;
              return (
                <div key={course.id}>
                  <div className="flex items-center">
                    <Link
                      href={`/courses/${course.id}`}
                      className="flex items-center gap-2 pl-3 py-1.5 rounded-full text-xs transition truncate flex-1 min-w-0 hover:bg-[var(--bg-card-hover)]"
                      style={{ color: courseActive ? "#0cc0df" : "var(--text-secondary)", fontWeight: courseActive ? 700 : 500 }}
                    >
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: courseActive ? "#0cc0df" : "var(--text-muted)" }} />
                      <span className="truncate">{course.name}</span>
                    </Link>
                    {hasModules && (
                      <button
                        onClick={() => setExpandedCourseIds(prev => {
                          const next = new Set(prev);
                          next.has(course.id) ? next.delete(course.id) : next.add(course.id);
                          return next;
                        })}
                        className="flex-shrink-0 p-1 rounded-full transition hover:bg-[var(--bg-card-hover)] mr-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {chevronSVG(courseExpanded)}
                      </button>
                    )}
                  </div>
                  {hasModules && courseExpanded && (
                    <div className="mt-0.5 space-y-0.5 pl-4">
                      {course.moduleGroups.map(mod => {
                        const modExpanded = expandedModuleIds.has(mod.id);
                        const modLessons = mod.lessonIds.map(lid => sidebarLessons.find(l => l.id === lid)).filter(Boolean) as SidebarLesson[];
                        return (
                          <div key={mod.id}>
                            <div className="flex items-center">
                              <button
                                onClick={() => setExpandedModuleIds(prev => {
                                  const next = new Set(prev);
                                  next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                                  return next;
                                })}
                                className="flex items-center gap-2 pl-3 py-1 rounded-full text-xs transition truncate flex-1 min-w-0 hover:bg-[var(--bg-card-hover)] text-left"
                                style={{ color: "var(--text-muted)" }}
                              >
                                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--border)" }} />
                                <span className="truncate">{mod.title}</span>
                              </button>
                              {modLessons.length > 0 && (
                                <button
                                  onClick={() => setExpandedModuleIds(prev => {
                                    const next = new Set(prev);
                                    next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                                    return next;
                                  })}
                                  className="flex-shrink-0 p-1 rounded-full transition hover:bg-[var(--bg-card-hover)] mr-1"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {chevronSVG(modExpanded)}
                                </button>
                              )}
                            </div>
                            {modExpanded && modLessons.length > 0 && (
                              <div className="mt-0.5 space-y-0.5 pl-4">
                                {modLessons.map(lesson => {
                                  const lessonActive = pathname === `/lessons/${lesson.id}`;
                                  return (
                                    <Link
                                      key={lesson.id}
                                      href={`/lessons/${lesson.id}`}
                                      className="flex items-center gap-2 pl-3 pr-3 py-1 rounded-full text-xs transition truncate hover:bg-[var(--bg-card-hover)]"
                                      style={{ color: lessonActive ? "#0cc0df" : "var(--text-muted)", fontWeight: lessonActive ? 700 : 400 }}
                                    >
                                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: lessonActive ? "#0cc0df" : "var(--border)" }} />
                                      <span className="truncate">{lesson.title}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const sidebarContent = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
      <div className="space-y-1.5 flex-1">
        {nav.map((item, i) => {
          if (item.href === "/courses") return renderCoursesItem(item, i);

          return (
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
                style={isActive(item.href) ? {} : { color: "var(--text-secondary)" }}
              >
                <span className="flex-shrink-0" style={isActive(item.href) ? { color: "#0a0b13" } : { color: "var(--text-muted)" }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                style={{ color: "var(--text-muted)" }}
              >
                {gripSVG}
              </div>
            </div>
          );
        })}
      </div>

      {/* NeXTBox external link */}
      <div className="px-0 pb-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 pl-3 pr-3 py-2 rounded-full text-sm font-medium transition-all duration-150 hover:bg-[var(--bg-card-hover)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>{nextboxIcon}</span>
          <span className="flex-1">NeXTBox</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)" }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    </nav>
  );

  return (
    <>
      <aside
        className="hidden lg:flex flex-col fixed left-3 z-40 rounded-3xl w-56"
        style={{ top: "76px", height: "calc(100vh - 88px)", background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}
      >
        {sidebarContent}
      </aside>

      {open && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={close} />
          <aside
            className="lg:hidden fixed left-3 z-50 w-56 flex flex-col rounded-3xl"
            style={{ top: "76px", height: "calc(100vh - 88px)", background: "var(--bg-sidebar)" }}
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
