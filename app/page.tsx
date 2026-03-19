"use client";

import { useCallback, useEffect, useRef, useState, Suspense, useMemo } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import LessonCard from "@/components/LessonCard";
import GenerateModal from "@/components/GenerateModal";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";
import type { Course } from "@/types/course";

type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";
type WidgetId = "activity" | "progress" | "activeCourse" | "schedule" | "lessons";
const DEFAULT_WIDGET_ORDER: WidgetId[] = ["activity", "progress", "activeCourse", "schedule", "lessons"];

// ── Drag-to-scroll ────────────────────────────────────────────────────────────
function useDragScroll() {
  const dragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      dragging.current = true;
      startX.current = e.pageX;
      scrollLeft.current = el.scrollLeft;
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      el.scrollLeft = scrollLeft.current - (e.pageX - startX.current);
    };
    const onMouseUp = () => {
      dragging.current = false;
      el.style.cursor = "grab";
      el.style.userSelect = "";
    };

    el.style.cursor = "grab";
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  return ref;
}



// ── Donut ring ────────────────────────────────────────────────────────────────
function DonutRing({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? value / total : 0;
  const dash = pct * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[84px] h-[84px]">
        <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="42" cy="42" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
          <circle
            cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <p className="text-xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[10px] text-center leading-tight" style={{ color }}>
        {label}
      </p>
    </div>
  );
}

// ── Area chart ────────────────────────────────────────────────────────────────
function AreaChart({ lessons }: { lessons: Lesson[] }) {
  const weeks = useMemo(() => {
    const buckets = new Array(8).fill(0);
    const now = Date.now();
    lessons.forEach((l) => {
      const age = now - new Date(l.createdAt).getTime();
      const idx = Math.floor(age / (7 * 24 * 60 * 60 * 1000));
      if (idx >= 0 && idx < 8) buckets[7 - idx]++;
    });
    return buckets;
  }, [lessons]);

  const W = 280, H = 80, pad = 10;
  const max = Math.max(...weeks, 1);
  const pts = weeks.map((v, i) => ({
    x: pad + (i / (weeks.length - 1)) * (W - pad * 2),
    y: H - pad - (v / max) * (H - pad * 2),
  }));

  function buildPath(points: { x: number; y: number }[]) {
    const d = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
    for (let i = 1; i < points.length; i++) {
      const p0 = points[Math.max(0, i - 2)];
      const p1 = points[i - 1];
      const p2 = points[i];
      const p3 = points[Math.min(points.length - 1, i + 1)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
    }
    return d.join(" ");
  }

  const linePath = buildPath(pts);
  const last = pts[pts.length - 1];
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80, overflow: "visible" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0cc0df" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0cc0df" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="#0cc0df" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="4" fill="#0cc0df" />
      <circle cx={last.x} cy={last.y} r="8" fill="none" stroke="#0cc0df" strokeWidth="1.5" strokeOpacity="0.35" />
    </svg>
  );
}

// ── Sortable lesson card ───────────────────────────────────────────────────────
interface SortableCardProps {
  lesson: Lesson;
  projects: SavedProject[];
  courses: Course[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenModal: (id: string) => void;
  onAssign: (lessonId: string, courseId: string | null) => void;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

function SortableLessonCard({ lesson, courses, onAssign, ...props }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <LessonCard lesson={lesson} courses={courses} onAssign={onAssign} {...props} gripProps={{ ...listeners, ...attributes }} />
    </div>
  );
}

// ── Sortable widget wrapper ────────────────────────────────────────────────────
function SortableWidget({ widgetId, span, onCycleSize, children }: {
  widgetId: WidgetId;
  span: 1 | 2 | 3;
  onCycleSize: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widgetId });
  const spanClass = span === 3 ? "lg:col-span-3" : span === 2 ? "lg:col-span-2" : "lg:col-span-1";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : undefined }}
      className={`relative group/widget ${spanClass}`}
    >
      {/* Hover controls: drag handle + resize */}
      <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover/widget:opacity-100 transition-opacity flex items-center gap-1">
        <div
          {...listeners}
          {...attributes}
          title="Drag to reorder"
          className="flex items-center justify-center rounded-full p-1.5 cursor-grab active:cursor-grabbing"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)", color: "var(--text-secondary)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
        <button
          onClick={onCycleSize}
          title={`Resize (${span}/3 columns)`}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)", color: "var(--text-secondary)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          {span}/3
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.toLowerCase().trim() ?? "";
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalLessonId, setModalLessonId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDuplicating, setBulkDuplicating] = useState(false);
  const [lessonOrder, setLessonOrder] = useState<string[]>([]);
  const [defaultSources, setDefaultSources] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filterCourse, setFilterCourse] = useState<"all" | "unassigned" | string>("all");

  // ── Widget sizes + order ──────────────────────────────────────────────────────
  const DEFAULT_WIDGET_SIZES: Record<WidgetId, 1 | 2 | 3> = { activity: 1, progress: 1, activeCourse: 1, schedule: 3, lessons: 3 };
  const [widgetSizes, setWidgetSizes] = useState<Record<WidgetId, 1 | 2 | 3>>(DEFAULT_WIDGET_SIZES);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(DEFAULT_WIDGET_ORDER);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const modalLesson = lessons.find(l => l.id === modalLessonId) ?? null;
  const scheduleRef = useDragScroll();

  // ── Computed stats ──────────────────────────────────────────────────────────
  const doneCount = lessons.filter(l => l.status === "done").length;
  const inProgressCount = lessons.filter(l => l.status === "generating" || l.status === "regenerating").length;
  const draftCount = lessons.filter(l => l.status === "draft").length;

  const upcoming = lessons
    .filter(l => l.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);

  const activeCourse = courses.length > 0
    ? [...courses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    : null;

  const activeCourseProgress = activeCourse
    ? lessons.filter(l => l.courseId === activeCourse.id && l.status === "done").length
    : 0;

  const activeCourseTotal = activeCourse
    ? lessons.filter(l => l.courseId === activeCourse.id).length
    : 0;

  // ── Sorted lesson list ──────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const orderedIds = lessonOrder.filter(id => lessons.some(l => l.id === id));
    const unordered = lessons
      .filter(l => !lessonOrder.includes(l.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const ordered = orderedIds.map(id => lessons.find(l => l.id === id)!);
    let all = [...unordered, ...ordered];
    if (searchQuery) {
      all = all.filter(l =>
        l.title?.toLowerCase().includes(searchQuery) ||
        l.subtitle?.toLowerCase().includes(searchQuery) ||
        l.topics?.toLowerCase().includes(searchQuery) ||
        l.tag?.toLowerCase().includes(searchQuery)
      );
    }
    if (filterCourse === "unassigned") return all.filter(l => !l.courseId);
    if (filterCourse !== "all") return all.filter(l => l.courseId === filterCourse);
    return all;
  }, [lessons, lessonOrder, searchQuery, filterCourse]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleSelectAll() {
    setSelected(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(l => l.id)));
  }

  function exitSelecting() { setSelecting(false); setSelected(new Set()); }

  async function handleAssign(lessonId: string, courseId: string | null) {
    const lesson = lessons.find(l => l.id === lessonId);
    const oldCourseId = lesson?.courseId;
    await fetch(`/api/lessons/${lessonId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: courseId ?? null }),
    });
    if (oldCourseId) {
      const oldCourse = courses.find(c => c.id === oldCourseId);
      if (oldCourse) {
        await fetch(`/api/courses/${oldCourseId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: oldCourse.lessonIds.filter(id => id !== lessonId) }),
        });
        setCourses(prev => prev.map(c => c.id === oldCourseId ? { ...c, lessonIds: c.lessonIds.filter(id => id !== lessonId) } : c));
      }
    }
    if (courseId) {
      const newCourse = courses.find(c => c.id === courseId);
      if (newCourse) {
        await fetch(`/api/courses/${courseId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: [...newCourse.lessonIds, lessonId] }),
        });
        setCourses(prev => prev.map(c => c.id === courseId ? { ...c, lessonIds: [...c.lessonIds, lessonId] } : c));
      }
    }
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, courseId: courseId ?? undefined } : l));
  }

  async function saveOrder(order: string[]) {
    await fetch("/api/user/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonOrder: order }) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex(l => l.id === active.id);
    const newIndex = sorted.findIndex(l => l.id === over.id);
    const newSorted = arrayMove(sorted, oldIndex, newIndex);
    const newOrder = newSorted.map(l => l.id);
    setLessonOrder(newOrder);
    saveOrder(newOrder);
  }

  function cycleWidgetSize(id: WidgetId) {
    setWidgetSizes(prev => {
      const next = { ...prev, [id]: (prev[id] === 1 ? 2 : prev[id] === 2 ? 3 : 1) as 1 | 2 | 3 };
      localStorage.setItem("dash-widget-sizes", JSON.stringify(next));
      return next;
    });
  }

  function handleWidgetDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWidgetOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id as WidgetId), prev.indexOf(over.id as WidgetId));
      localStorage.setItem("dash-widget-order", JSON.stringify(next));
      return next;
    });
  }

  async function handleBulkDuplicate() {
    setBulkDuplicating(true);
    for (const id of [...selected]) await handleDuplicate(id);
    exitSelecting();
    setBulkDuplicating(false);
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} lesson${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await Promise.all([...selected].map(id => fetch(`/api/lessons/${id}`, { method: "DELETE" })));
    setLessons(prev => prev.filter(l => !selected.has(l.id)));
    exitSelecting();
    setBulkDeleting(false);
  }

  async function loadLessons() {
    const data = await fetch("/api/lessons").then(r => r.json());
    setLessons(Array.isArray(data) ? data : []);
  }

  async function loadProjects() {
    const data = await fetch("/api/projects").then(r => r.json());
    setProjects(Array.isArray(data) ? data : []);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lesson?")) return;
    await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    setLessons(prev => prev.filter(l => l.id !== id));
  }

  async function handleDuplicate(id: string) {
    const lesson = await fetch(`/api/lessons/${id}`).then(r => r.json());
    const { title, subtitle, topics, deadline, tag, overview, learningTargets, vocabulary, warmUp, guidedLab, selfPaced, submissionChecklist, checkpoint, industryBestPractices, slideContent, devJournalPrompt, rubric, taChecklist, sources, studentLevel, quizQuestions } = lesson;
    const copy = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Copy of ${title}`, subtitle, topics, deadline, tag, overview, learningTargets, vocabulary, warmUp, guidedLab, selfPaced, submissionChecklist, checkpoint, industryBestPractices, slideContent, devJournalPrompt, rubric: rubric ?? taChecklist ?? "", sources: sources || defaultSources, studentLevel, quizQuestions }),
    }).then(r => r.json());
    setLessons(prev => [copy, ...prev]);
  }

  async function handleGenerateWithOptions(id: string, files: FileChoice[], destination: Destination, templateId?: string) {
    const lesson = lessons.find(l => l.id === id);
    const inProgressStatus = lesson?.status === "done" ? "regenerating" : "generating";
    setLessons(prev => prev.map(l => l.id === id ? { ...l, status: inProgressStatus } : l));
    const res = await fetch(`/api/generate/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files, destination, templateId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setLessons(prev => prev.map(l => l.id === id ? { ...l, status: "error", errorMessage: data.error } : l));
      setToast({ message: data.error || "Generation failed.", type: "error" });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    if (destination === "drive") {
      const data = await res.json();
      setLessons(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
      await loadProjects();
      setToast({ message: "Bundle saved to Google Drive!", type: "success" });
    } else {
      const { downloads } = await res.json();
      for (const file of downloads) {
        const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.filename });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setLessons(prev => prev.map(l => l.id === id ? { ...l, status: "done" } : l));
      setToast({ message: "PDFs downloaded!", type: "success" });
    }
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (status === "authenticated") {
      Promise.all([
        loadLessons(),
        loadProjects(),
        fetch("/api/courses").then(r => r.json()).then(d => setCourses(Array.isArray(d) ? d : [])),
        fetch("/api/user/settings").then(r => r.json()).then(s => {
          if (Array.isArray(s.lessonOrder)) setLessonOrder(s.lessonOrder);
          if (s.defaultSources) setDefaultSources(s.defaultSources);
        }),
      ]).then(() => setLoading(false));
    }
  }, [status]);

  // ── Load persisted widget sizes + order from localStorage ────────────────────
  useEffect(() => {
    try {
      const ws = localStorage.getItem("dash-widget-sizes");
      if (ws) setWidgetSizes(JSON.parse(ws));
      const wo = localStorage.getItem("dash-widget-order");
      if (wo) {
        const saved: WidgetId[] = JSON.parse(wo);
        // Append any new widgets not yet in the saved order
        const merged = [...saved, ...DEFAULT_WIDGET_ORDER.filter(id => !saved.includes(id))];
        setWidgetOrder(merged);
      }
    } catch {}
  }, []);

  // ── Widget render helpers ───────────────────────────────────────────────────
  function renderActivityWidget() {
    return (
      <div className="rounded-3xl p-5 flex flex-col gap-4 h-full" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Activity</p>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>
            8 weeks
          </span>
        </div>
        <div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{lessons.length}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>total lessons created</p>
        </div>
        <div>
          <AreaChart lessons={lessons} />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>8 wks ago</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>This week</span>
          </div>
        </div>

        {/* By Course */}
        {courses.length > 0 && (
          <div className="pt-3 flex flex-col gap-2.5" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>
              By Course
            </p>
            {(() => {
              const dotColors = ["#0cc0df", "#6366f1", "#ff8c4a", "#2dd4a0"];
              return courses.slice(0, 4).map((course, i) => {
                const total = lessons.filter(l => l.courseId === course.id).length;
                const done = lessons.filter(l => l.courseId === course.id && l.status === "done").length;
                const pct = total > 0 ? (done / total) * 100 : 0;
                const color = dotColors[i % dotColors.length];
                return (
                  <Link key={course.id} href={`/courses/${course.id}`} className="flex items-center gap-2.5 group">
                    <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${color}22` }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate group-hover:text-[#0cc0df] transition" style={{ color: "var(--text-primary)" }}>
                        {course.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-card-hover)" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-[10px] shrink-0 font-semibold" style={{ color: "var(--text-muted)" }}>
                          {total}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              });
            })()}
            {courses.length > 4 && (
              <Link href="/courses" className="text-[10px] text-[#0cc0df] hover:underline">
                +{courses.length - 4} more courses →
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderProgressWidget() {
    return (
      <div className="rounded-3xl p-5 flex flex-col gap-4 h-full" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Progress</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
            {lessons.length > 0 ? Math.round((doneCount / lessons.length) * 100) : 0}%
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>lessons generated</p>
        </div>
        <div className="flex items-end justify-around pt-1">
          <DonutRing value={inProgressCount} total={Math.max(lessons.length, 1)} color="#ff8c4a" label="In Progress" />
          <DonutRing value={doneCount}        total={Math.max(lessons.length, 1)} color="#0cc0df"  label="Generated" />
          <DonutRing value={draftCount}       total={Math.max(lessons.length, 1)} color="#6366f1"  label="Draft" />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {[
            { label: "In Progress", value: inProgressCount, color: "#ff8c4a" },
            { label: "Generated",   value: doneCount,       color: "#0cc0df" },
            { label: "Draft",       value: draftCount,      color: "#6366f1" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
              <p className="text-[10px]" style={{ color }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderActiveCourseWidget() {
    return (
      <div className="rounded-3xl p-5 flex flex-col gap-4 h-full" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Active Course</p>
          <Link href="/courses" className="text-[10px] text-[#0cc0df] hover:underline">
            View all →
          </Link>
        </div>

        {activeCourse ? (
          <>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {activeCourse.settings?.subject && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                    {activeCourse.settings.subject}
                  </span>
                )}
                {activeCourse.gradeLevel && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
                    {activeCourse.gradeLevel}
                  </span>
                )}
                {activeCourse.settings?.studentLevel && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize" style={{ background: "rgba(45,212,160,0.12)", color: "#2dd4a0" }}>
                    {activeCourse.settings.studentLevel}
                  </span>
                )}
              </div>
              <Link href={`/courses/${activeCourse.id}`} className="text-base font-bold leading-snug mb-1 hover:underline" style={{ color: "var(--text-primary)" }}>
                {activeCourse.title}
              </Link>
              {activeCourse.description && (
                <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--text-secondary)" }}>
                  {activeCourse.description}
                </p>
              )}
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Lessons generated</p>
                  <p className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {activeCourseProgress} / {activeCourseTotal}
                  </p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-card-hover)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${activeCourseTotal > 0 ? (activeCourseProgress / activeCourseTotal) * 100 : 0}%`,
                      background: "linear-gradient(90deg, #6366f1, #818cf8)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Upcoming deadlines in this course */}
            {upcoming.filter(l => l.courseId === activeCourse.id).length > 0 && (
              <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--sidebar-label)" }}>
                  Upcoming
                </p>
                {upcoming.filter(l => l.courseId === activeCourse.id).slice(0, 2).map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-2 py-1">
                    <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{l.title}</p>
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: "#ff8c4a" }}>{l.deadline}</span>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/courses"
              className="flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)" }}
            >
              Open Courses
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <div className="w-10 h-10 rounded-full bg-[#0cc0df]/10 flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No courses yet</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Organize your lessons into courses for better management.</p>
            <Link href="/courses/new" className="rounded-full bg-[#0cc0df] px-4 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition">
              Create a Course
            </Link>
          </div>
        )}
      </div>
    );
  }

  function renderScheduleWidget(span: 1 | 2 | 3 = 3) {
    const accentColors = ["#6366f1", "#0cc0df", "#ff8c4a", "#2dd4a0", "#f59e0b"];
    return (
      <div className="rounded-3xl p-5 h-full" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Schedule</p>
          <Link href="/schedule" className="text-[10px] text-[#0cc0df] hover:underline">Full schedule →</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No upcoming deadlines.</p>
        ) : span === 3 ? (
          /* Horizontal scroll strip — full width */
          <div ref={scheduleRef} className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {upcoming.map((lesson, i) => {
              const color = accentColors[i % accentColors.length];
              return (
                <div key={lesson.id} className="shrink-0 rounded-3xl p-4 flex flex-col gap-2 min-w-[200px] max-w-[220px] transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: "var(--bg-card-hover)" }}>
                  <div className="h-0.5 rounded-full w-8" style={{ background: color }} />
                  <Link href={`/lessons/${lesson.id}`} className="text-xs font-semibold leading-snug line-clamp-2 hover:underline" style={{ color: "var(--text-primary)" }}>{lesson.title}</Link>
                  <div className="flex items-center gap-2 mt-auto flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: `${color}22`, color }}>Due {lesson.deadline}</span>
                    {lesson.tag && <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{lesson.tag}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vertical list — narrow widths */
          <div className="flex flex-col gap-2">
            {upcoming.map((lesson, i) => {
              const color = accentColors[i % accentColors.length];
              return (
                <div key={lesson.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "var(--bg-card-hover)" }}>
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <Link href={`/lessons/${lesson.id}`} className="text-xs font-semibold leading-snug line-clamp-1 hover:underline" style={{ color: "var(--text-primary)" }}>{lesson.title}</Link>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold" style={{ color }}>Due {lesson.deadline}</span>
                      {lesson.tag && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{lesson.tag}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderLessonsWidget(span: 1 | 2 | 3 = 3) {
    return (
      <div className="rounded-3xl p-5 space-y-4 h-full" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Lessons
            {filterCourse === "unassigned" && <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>· Unassigned only</span>}
          </p>
          <Link href="/lessons/new" className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition">
            + New Lesson
          </Link>
        </div>
        {courses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(["all", "unassigned"] as const).map(f => (
              <button key={f} onClick={() => setFilterCourse(f)} className="rounded-full px-3 py-1 text-xs font-medium transition"
                style={filterCourse === f ? { background: "#0cc0df", color: "#0a0b13" } : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {f === "all" ? "All" : "Unassigned"}
              </button>
            ))}
            {courses.map(c => (
              <button key={c.id} onClick={() => setFilterCourse(c.id)} className="rounded-full px-3 py-1 text-xs font-medium transition"
                style={filterCourse === c.id ? { background: "var(--accent-purple)", color: "#fff" } : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {c.title}
              </button>
            ))}
          </div>
        )}
        {sorted.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            {filterCourse === "unassigned" ? "All lessons are assigned to a course." : "No lessons yet."}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map(l => l.id)} strategy={rectSortingStrategy}>
              <div className={`grid grid-cols-1 gap-4 ${span >= 2 ? "sm:grid-cols-2" : ""} ${span === 3 ? "lg:grid-cols-3" : ""}`}>
                {sorted.map(l => (
                  <SortableLessonCard key={l.id} lesson={l} projects={projects.filter(p => p.lessonId === l.id)} courses={courses}
                    onDelete={handleDelete} onDuplicate={handleDuplicate} onOpenModal={id => setModalLessonId(id)}
                    onAssign={handleAssign} selecting={selecting} selected={selected.has(l.id)} onToggleSelect={toggleSelect} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    );
  }

  // ── Sign-in screen ─────────────────────────────────────────────────────────
  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="max-w-md w-full rounded-3xl px-8 py-10" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="NeXTScript" width={200} height={56} className="h-20 w-auto brightness-0 invert dark:brightness-100 dark:invert-0" priority />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--accent)" }}>Curriculum Builder</p>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
            Create and edit lessons, then generate a full Google Drive bundle — slides, poster, and quiz — with one click.
          </p>
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg w-full justify-center"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return <p className="text-[#0cc0df] text-sm text-center mt-20">Loading…</p>;
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const today = new Date();
  const dayName = today.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = today.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">

      {/* ── Welcome row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: icon + greeting */}
        <div className="flex items-center gap-3 rounded-full px-5 py-4" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255, 180, 50, 0.15)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Welcome back!</p>
            <h1 className="text-xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{firstName}</h1>
          </div>
        </div>
        {/* Right: date badge */}
        <div className="hidden sm:flex items-center gap-3 rounded-full px-5 py-4" style={{ background: "var(--bg-sidebar)", boxShadow: "var(--shadow-card)" }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-xl" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
            {today.getDate()}
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{dayName},</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </div>

      {/* ── Widget row ───────────────────────────────────────────────────────── */}
      {!loading && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}>
          <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {widgetOrder.map(widgetId => (
                <SortableWidget key={widgetId} widgetId={widgetId} span={widgetSizes[widgetId]} onCycleSize={() => cycleWidgetSize(widgetId)}>
                  {widgetId === "activity" && renderActivityWidget()}
                  {widgetId === "progress" && renderProgressWidget()}
                  {widgetId === "activeCourse" && renderActiveCourseWidget()}
                  {widgetId === "schedule" && renderScheduleWidget(widgetSizes[widgetId])}
                  {widgetId === "lessons" && renderLessonsWidget(widgetSizes[widgetId])}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}


      <GenerateModal lesson={modalLesson} onClose={() => setModalLessonId(null)} onGenerate={handleGenerateWithOptions} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-3xl px-5 py-3.5 shadow-2xl text-sm font-semibold transition-all ${toast.type === "success" ? "bg-[#2dd4a0] text-[#0a0b13]" : "bg-red-500 text-white"}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 text-xs">✕</button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
