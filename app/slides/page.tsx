"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
import type { Lesson } from "@/types/lesson";
import type { Course } from "@/types/course";

const STATUS_COLOR: Record<Lesson["status"], { bg: string; text: string; label: string }> = {
  draft:        { bg: "var(--bg-card-hover)",  text: "var(--text-muted)", label: "Draft" },
  generating:   { bg: "rgba(255,140,74,0.12)", text: "#ff8c4a",           label: "Generating…" },
  regenerating: { bg: "rgba(12,192,223,0.12)", text: "#0cc0df",           label: "Regenerating…" },
  done:         { bg: "rgba(45,212,160,0.12)", text: "#2dd4a0",           label: "Done" },
  error:        { bg: "rgba(239,68,68,0.12)",  text: "#ef4444",           label: "Error" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const gripSVG = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
  </svg>
);

function SortableSlideCard({
  lesson,
  courses,
  assigningOpen,
  onToggleAssign,
  onAssign,
}: {
  lesson: Lesson;
  courses: Course[];
  assigningOpen: boolean;
  onToggleAssign: (id: string) => void;
  onAssign: (lessonId: string, courseId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const course = courses.find(c => c.id === lesson.courseId);
  const s = STATUS_COLOR[lesson.status];

  return (
    <div
      ref={setNodeRef}
      className={`group relative rounded-3xl p-5 space-y-3 ${isDragging ? "" : "hover:-translate-y-1"} transition-all duration-200`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Drag handle */}
      <div
        {...listeners} {...attributes}
        title="Drag to reorder"
        className="absolute top-3 right-3 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
        style={{ color: "var(--text-muted)", background: "var(--bg-card-hover)" }}
      >
        {gripSVG}
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>
            {lesson.title}
          </p>
          {lesson.subtitle && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{lesson.subtitle}</p>
          )}
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mr-7" style={{ background: s.bg, color: s.text }}>
          {s.label}
        </span>
      </div>

      {/* Course assignment badge / dropdown */}
      <div className="relative">
        <button
          onClick={e => { e.stopPropagation(); onToggleAssign(lesson.id); }}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition hover:opacity-80"
          style={course
            ? { background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }
            : { background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px dashed var(--border)" }
          }
        >
          {course ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              {course.title}
            </>
          ) : "Unassigned"}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {assigningOpen && (
          <>
          <div className="fixed inset-0 z-20" onClick={() => onToggleAssign(lesson.id)} />
          <div className="absolute left-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[180px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
            <button
              onClick={() => onAssign(lesson.id, null)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
              style={{ color: !lesson.courseId ? "var(--accent-purple)" : "var(--text-muted)", fontWeight: !lesson.courseId ? 600 : 400 }}
            >
              {!lesson.courseId ? "✓ " : ""}No course
            </button>
            {courses.map(c => (
              <button
                key={c.id}
                onClick={() => onAssign(lesson.id, c.id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                style={{ color: lesson.courseId === c.id ? "var(--accent-purple)" : "var(--text-primary)", fontWeight: lesson.courseId === c.id ? 600 : 400 }}
              >
                {lesson.courseId === c.id ? "✓ " : ""}{c.title}
              </button>
            ))}
          </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Updated {fmt(lesson.updatedAt)}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/lessons/${lesson.id}`}
            className="rounded-full px-3 py-1 text-xs font-semibold transition"
            style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            View Lesson
          </Link>
          <Link
            href={`/slides/${lesson.id}`}
            className="rounded-full bg-[#0cc0df] px-3 py-1 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SlidesPage() {
  useSession({ required: true });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "done">("all");
  const [order, setOrder] = useState<string[]>([]);
  const [assigningLessonId, setAssigningLessonId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sort-slides");
      if (saved) setOrder(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/lessons").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]).then(([l, c]) => {
      setLessons(Array.isArray(l) ? l : []);
      setCourses(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, []);

  // Merge saved order with fetched lessons: ordered items first, then new items appended
  const sorted: Lesson[] = (() => {
    const orderedIds = order.filter(id => lessons.some(l => l.id === id));
    const unordered = lessons.filter(l => !order.includes(l.id));
    const ordered = orderedIds.map(id => lessons.find(l => l.id === id)!);
    return [...ordered, ...unordered];
  })();

  const filtered = sorted.filter(l => {
    if (filterCourse === "unassigned" && l.courseId) return false;
    if (filterCourse !== "all" && filterCourse !== "unassigned" && l.courseId !== filterCourse) return false;
    if (filterStatus === "draft" && l.status !== "draft") return false;
    if (filterStatus === "done" && l.status !== "done") return false;
    return true;
  });

  async function handleAssignLesson(lessonId: string, newCourseId: string | null) {
    setAssigningLessonId(null);
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    const oldCourseId = lesson.courseId;
    if (oldCourseId === (newCourseId ?? undefined)) return;

    await fetch(`/api/lessons/${lessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: newCourseId ?? null, released: false }),
    });

    if (oldCourseId) {
      const oldCourse = courses.find(c => c.id === oldCourseId);
      if (oldCourse) {
        await fetch(`/api/courses/${oldCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: oldCourse.lessonIds.filter(id => id !== lessonId) }),
        });
        setCourses(prev => prev.map(c => c.id === oldCourseId ? { ...c, lessonIds: c.lessonIds.filter(id => id !== lessonId) } : c));
      }
    }

    if (newCourseId) {
      const newCourse = courses.find(c => c.id === newCourseId);
      if (newCourse && !newCourse.lessonIds.includes(lessonId)) {
        await fetch(`/api/courses/${newCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: [...newCourse.lessonIds, lessonId] }),
        });
        setCourses(prev => prev.map(c => c.id === newCourseId ? { ...c, lessonIds: [...c.lessonIds, lessonId] } : c));
      }
    }

    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, courseId: newCourseId ?? undefined, released: false } : l));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex(l => l.id === active.id);
    const newIndex = sorted.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newSorted = arrayMove(sorted, oldIndex, newIndex);
    const newOrder = newSorted.map(l => l.id);
    setOrder(newOrder);
    localStorage.setItem("sort-slides", JSON.stringify(newOrder));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Content</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Slides</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Create and edit slide content for your lessons.
          </p>
        </div>
        <Link
          href="/slides/new"
          className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition shadow"
        >
          + New Slides
        </Link>
      </div>

      {/* Filter pills */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          {/* Status filters */}
          {(["all", "draft", "done"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={filterStatus === f
                ? { background: "#0cc0df", color: "#0a0b13" }
                : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {f === "all" ? "All" : f === "draft" ? "Draft" : "Done"}
            </button>
          ))}

          {/* Course filters */}
          {courses.length > 0 && (
            <>
              <span className="self-center text-xs" style={{ color: "var(--border)" }}>|</span>
              <button
                onClick={() => setFilterCourse("all")}
                className="rounded-full px-3 py-1 text-xs font-medium transition"
                style={filterCourse === "all"
                  ? { background: "var(--accent-purple)", color: "#fff" }
                  : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                All Courses
              </button>
              <button
                onClick={() => setFilterCourse("unassigned")}
                className="rounded-full px-3 py-1 text-xs font-medium transition"
                style={filterCourse === "unassigned"
                  ? { background: "var(--accent-purple)", color: "#fff" }
                  : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                Unassigned
              </button>
              {courses.map(c => (
                <button
                  key={c.id}
                  onClick={() => setFilterCourse(c.id)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition"
                  style={filterCourse === c.id
                    ? { background: "var(--accent-purple)", color: "#fff" }
                    : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  {c.title}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No slides yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Create a slide deck to get started.</p>
          <Link
            href="/slides/new"
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Create your first slides
          </Link>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(l => l.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" onClick={() => setAssigningLessonId(null)}>
              {filtered.map(lesson => (
                <SortableSlideCard
                  key={lesson.id}
                  lesson={lesson}
                  courses={courses}
                  assigningOpen={assigningLessonId === lesson.id}
                  onToggleAssign={id => setAssigningLessonId(prev => prev === id ? null : id)}
                  onAssign={handleAssignLesson}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
