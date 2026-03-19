"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSession, signIn } from "next-auth/react";
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

// ── Donut ring ────────────────────────────────────────────────────────────────
function DonutRing({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? value / total : 0;
  const dash = pct * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[64px] h-[64px]">
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <p className="text-lg font-bold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[10px] text-center leading-tight" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

// ── Weekly activity bars ───────────────────────────────────────────────────────
function ActivityBars({ lessons }: { lessons: Lesson[] }) {
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

  const max = Math.max(...weeks, 1);

  return (
    <div className="flex items-end gap-1 h-14 w-full">
      {weeks.map((count, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-500"
          style={{
            height: `${Math.max((count / max) * 100, count > 0 ? 6 : 2)}%`,
            background: i === 7 ? "#0cc0df" : "rgba(12,192,223,0.25)",
          }}
        />
      ))}
    </div>
  );
}

// ── Sortable lesson card ───────────────────────────────────────────────────────
interface SortableCardProps {
  lesson: Lesson;
  projects: SavedProject[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenModal: (id: string) => void;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

function SortableLessonCard({ lesson, ...props }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <LessonCard lesson={lesson} {...props} gripProps={{ ...listeners, ...attributes }} />
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard() {
  const { data: session, status } = useSession();
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const modalLesson = lessons.find(l => l.id === modalLessonId) ?? null;

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
    return [...unordered, ...ordered];
  }, [lessons, lessonOrder]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleSelectAll() {
    setSelected(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(l => l.id)));
  }

  function exitSelecting() { setSelecting(false); setSelected(new Set()); }

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

  // ── Sign-in screen ─────────────────────────────────────────────────────────
  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="max-w-md w-full rounded-2xl px-8 py-10" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="NeXTScript" width={200} height={56} className="h-20 w-auto brightness-0 invert dark:brightness-100 dark:invert-0" priority />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--accent)" }}>Curriculum Builder</p>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
            Create and edit lessons, then generate a full Google Drive bundle — slides, poster, and quiz — with one click.
          </p>
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg w-full justify-center"
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Welcome back
          </p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{firstName}</h1>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{dayName}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{dateStr}</p>
        </div>
      </div>

      {/* ── 3-column widget row ───────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Activity + By Course ── */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
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
              <ActivityBars lessons={lessons} />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>8 wks ago</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>This week</span>
              </div>
            </div>

            {/* By Course */}
            {courses.length > 0 && (
              <div className="pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>
                  By Course
                </p>
                {courses.slice(0, 4).map(course => (
                  <Link key={course.id} href={`/courses/${course.id}`} className="flex items-center justify-between group gap-2">
                    <p className="text-xs truncate group-hover:text-[#0cc0df] transition" style={{ color: "var(--text-secondary)" }}>
                      {course.title}
                    </p>
                    <span className="text-[10px] font-bold shrink-0 rounded px-1.5 py-0.5" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                      {course.lessonIds.length}
                    </span>
                  </Link>
                ))}
                {courses.length > 4 && (
                  <Link href="/courses" className="text-[10px] text-[#0cc0df] hover:underline">
                    +{courses.length - 4} more courses →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ── Progress donuts ── */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
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
              <DonutRing value={draftCount}       total={Math.max(lessons.length, 1)} color="#2dd4a0"  label="Draft" />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {[
                { label: "In Progress", value: inProgressCount, color: "#ff8c4a" },
                { label: "Generated",   value: doneCount,       color: "#0cc0df" },
                { label: "Draft",       value: draftCount,      color: "#2dd4a0" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                  <p className="text-[10px]" style={{ color }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Active Course ── */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
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
                  <p className="text-base font-bold leading-snug mb-1" style={{ color: "var(--text-primary)" }}>
                    {activeCourse.title}
                  </p>
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
                        className="h-full rounded-full bg-[#0cc0df] transition-all duration-700"
                        style={{ width: `${activeCourseTotal > 0 ? (activeCourseProgress / activeCourseTotal) * 100 : 0}%` }}
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
                  href={`/courses/${activeCourse.id}`}
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-[#0a0b13] bg-[#0cc0df] hover:opacity-90 transition"
                >
                  Open Course
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                <div className="w-10 h-10 rounded-xl bg-[#0cc0df]/10 flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No courses yet</p>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Organize your lessons into courses for better management.</p>
                <Link href="/courses/new" className="rounded-xl bg-[#0cc0df] px-4 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition">
                  Create a Course
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Upcoming deadlines strip (if any) ───────────────────────────────── */}
      {!loading && upcoming.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>
              Upcoming Deadlines
            </p>
            <Link href="/schedule" className="text-[10px] text-[#0cc0df] hover:underline">
              Full schedule →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {upcoming.map(lesson => (
              <Link
                key={lesson.id}
                href={`/lessons/${lesson.id}`}
                className="shrink-0 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[160px] transition hover:opacity-80"
                style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ff8c4a] shrink-0" />
                  <span className="text-[10px] font-bold" style={{ color: "#ff8c4a" }}>{lesson.deadline}</span>
                </div>
                <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                {lesson.tag && (
                  <span className="text-[10px] self-start px-1.5 py-0.5 rounded" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                    {lesson.tag}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── All Lessons section ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>
            All Lessons
            {lessons.filter(l => !l.courseId).length !== lessons.length && (
              <span className="ml-2 normal-case font-normal" style={{ color: "var(--text-muted)" }}>
                ({lessons.filter(l => !l.courseId).length} standalone)
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {!loading && sorted.length > 0 && (
              selecting ? (
                <button onClick={exitSelecting} className="rounded-xl border px-3 py-1.5 text-xs font-semibold transition" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Cancel
                </button>
              ) : (
                <button onClick={() => setSelecting(true)} className="rounded-xl border px-3 py-1.5 text-xs font-semibold transition" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Select
                </button>
              )
            )}
            <Link href="/lessons/new" className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition shadow">
              + New Lesson
            </Link>
          </div>
        </div>

        {/* Bulk action bar */}
        {selecting && (
          <div className="flex items-center justify-between mb-4 rounded-2xl px-4 py-3 shadow-sm" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
            <div className="flex items-center gap-3">
              <div
                onClick={toggleSelectAll}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-150 ${
                  selected.size === sorted.length && sorted.length > 0
                    ? "bg-[#0cc0df] border-[#0cc0df]"
                    : selected.size > 0
                    ? "bg-[#0cc0df]/30 border-[#0cc0df]"
                    : "border-[var(--border)]"
                }`}
                style={selected.size === 0 ? { background: "var(--bg-body)" } : {}}
              >
                {selected.size === sorted.length && sorted.length > 0 ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#0d1c35]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : selected.size > 0 ? (
                  <div className="w-2 h-0.5 bg-[#0d1c35]" />
                ) : null}
              </div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {selected.size === 0 ? "Select all" : `${selected.size} of ${sorted.length} selected`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDuplicate}
                disabled={selected.size === 0 || bulkDuplicating}
                className="rounded-xl px-4 py-1.5 text-sm font-semibold disabled:opacity-40 transition"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {bulkDuplicating ? "Duplicating…" : `Duplicate${selected.size > 0 ? ` (${selected.size})` : ""}`}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selected.size === 0 || bulkDeleting}
                className="rounded-xl bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition"
              >
                {bulkDeleting ? "Deleting…" : `Delete${selected.size > 0 ? ` (${selected.size})` : ""}`}
              </button>
            </div>
          </div>
        )}

        {/* Lesson grid */}
        {loading ? (
          <p className="text-[#0cc0df] text-sm">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No lessons yet.</p>
            <Link href="/lessons/new" className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
              Create your first lesson
            </Link>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map(l => l.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                {sorted.map(lesson => (
                  <SortableLessonCard
                    key={lesson.id}
                    lesson={lesson}
                    projects={projects.filter(p => p.lessonId === lesson.id)}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onOpenModal={setModalLessonId}
                    selecting={selecting}
                    selected={selected.has(lesson.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <GenerateModal lesson={modalLesson} onClose={() => setModalLessonId(null)} onGenerate={handleGenerateWithOptions} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-semibold transition-all ${toast.type === "success" ? "bg-[#2dd4a0] text-[#0a0b13]" : "bg-red-500 text-white"}`}>
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
