"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Course } from "@/types/course";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLOR: Record<Lesson["status"], string> = {
  draft:        "bg-[var(--text-muted)]",
  generating:   "bg-[#ff8c4a] animate-pulse",
  regenerating: "bg-[#0cc0df] animate-pulse",
  done:         "bg-[#2dd4a0]",
  error:        "bg-red-500",
};

const STATUS_LABEL: Record<Lesson["status"], string> = {
  draft: "Draft", generating: "Generating…", regenerating: "Regenerating…", done: "Done", error: "Error",
};

const gripSVG = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
  </svg>
);

function CourseCard({
  course,
  onDelete,
  onDuplicate,
  gripProps,
}: {
  course: Course;
  onDelete: (id: string) => void;
  onDuplicate: (course: Course) => void;
  gripProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div
      className="group h-full rounded-3xl flex flex-col hover:-translate-y-1 transition-all duration-200"
      style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Drag handle */}
      {gripProps && (
        <div
          {...gripProps}
          title="Drag to reorder"
          className="absolute top-3 right-3 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
          style={{ color: "var(--text-muted)", background: "var(--bg-card-hover)" }}
        >
          {gripSVG}
        </div>
      )}

      <div className="flex flex-col gap-3 p-5 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold text-base leading-snug" style={{ color: "var(--text-primary)" }}>
            {course.title}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {course.settings?.studentLevel && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-[#0cc0df] capitalize" style={{ background: "var(--accent-bg)" }}>
                {course.settings.studentLevel}
              </span>
            )}
            <button
              onClick={() => onDuplicate(course)}
              title="Duplicate course"
              className="p-1.5 rounded-full transition opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>

        {/* Description */}
        {course.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {course.description}
          </p>
        )}

        {/* Tags */}
        {(course.settings?.subject || course.gradeLevel || course.term) && (
          <div className="flex flex-wrap gap-1.5">
            {course.settings?.subject && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
                {course.settings.subject}
              </span>
            )}
            {course.gradeLevel && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
                {course.gradeLevel}
              </span>
            )}
            {course.term && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
                {course.term}
              </span>
            )}
          </div>
        )}

        {/* Lesson count + date */}
        <div className="mt-auto flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--accent-purple)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            {course.lessonIds.length} {course.lessonIds.length === 1 ? "lesson" : "lessons"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fmt(course.createdAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-5 pb-5">
        <Link
          href={`/courses/${course.id}`}
          className="flex-1 flex items-center justify-center rounded-full bg-[#0cc0df] py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 active:scale-95 transition-all"
        >
          Open
        </Link>
        <button
          onClick={() => onDelete(course.id)}
          title="Delete course"
          className="p-2 rounded-full transition hover:bg-red-500/10 hover:text-red-500 active:scale-95"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  );
}

function SortableCourseCard({ course, onDelete, onDuplicate }: { course: Course; onDelete: (id: string) => void; onDuplicate: (course: Course) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <CourseCard
        course={course}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        gripProps={{ ...listeners, ...attributes } as React.HTMLAttributes<HTMLDivElement>}
      />
    </div>
  );
}

function SortableLessonRow({
  lesson,
  projects,
  courses,
  isFirst,
  isLast,
  onDelete,
  onDuplicate,
}: {
  lesson: Lesson;
  projects: SavedProject[];
  courses: Course[];
  isFirst: boolean;
  isLast: boolean;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const course = courses.find(c => c.id === lesson.courseId);
  const deck = projects.find(p => p.type === "deck");
  const form = projects.find(p => p.type === "form");

  return (
    <div
      ref={setNodeRef}
      className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--bg-card-hover)] ${isFirst ? "rounded-t-3xl" : ""} ${isLast ? "rounded-b-3xl" : ""}`}
      style={{
        background: "var(--bg-card)",
        borderTop: !isFirst ? "1px solid var(--border)" : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Drag handle */}
      <div
        {...listeners} {...attributes}
        title="Drag to reorder"
        className="p-1 rounded-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        {gripSVG}
      </div>

      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[lesson.status]}`} />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="text-sm font-semibold truncate shrink-0" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
          {lesson.subtitle && (
            <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{lesson.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{STATUS_LABEL[lesson.status]}</span>
          {course && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
              {course.title}
            </span>
          )}
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {fmt(lesson.createdAt)}
          </span>
        </div>
      </div>

      {/* Asset pills */}
      {(deck || form || lesson.folderUrl) && (
        <div className="flex items-center gap-1 shrink-0">
          {deck && (
            <Link href={`/slides/${lesson.id}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80" style={{ background: "rgba(12,192,223,0.12)", border: "1px solid rgba(12,192,223,0.35)", color: "#0cc0df" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Slides
            </Link>
          )}
          {form && (
            <Link href="/quizzes" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80" style={{ background: "rgba(255,140,74,0.12)", border: "1px solid rgba(255,140,74,0.35)", color: "#ff8c4a" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Quiz
            </Link>
          )}
          {lesson.folderUrl && (
            <a href={lesson.folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80" style={{ background: "rgba(45,212,160,0.12)", border: "1px solid rgba(45,212,160,0.35)", color: "#2dd4a0" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Drive ↗
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/lessons/${lesson.id}`}
          className="rounded-full bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition"
        >
          View
        </Link>
        <button
          onClick={() => onDuplicate(lesson.id)}
          title="Duplicate lesson"
          className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button
          onClick={() => onDelete(lesson.id)}
          title="Delete lesson"
          className="p-1.5 rounded-full transition hover:text-red-500 hover:bg-red-500/10"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  useSession({ required: true });
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "done">("all");
  const [courseOrder, setCourseOrder] = useState<string[]>([]);
  const [lessonOrder, setLessonOrder] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    try {
      const sc = localStorage.getItem("sort-courses");
      if (sc) setCourseOrder(JSON.parse(sc));
      const sl = localStorage.getItem("sort-lessons-cp");
      if (sl) setLessonOrder(JSON.parse(sl));
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/courses").then(r => r.json()),
      fetch("/api/lessons").then(r => r.json()),
      fetch("/api/projects").then(r => r.json()),
    ]).then(([courseData, lessonData, projectData]) => {
      setCourses(Array.isArray(courseData) ? courseData : []);
      setLessons(Array.isArray(lessonData) ? lessonData : []);
      setProjects(Array.isArray(projectData) ? projectData : []);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this course? This will not delete its lessons.")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE" });
    setCourses((prev) => prev.filter((c) => c.id !== id));
    // Clear stale courseId from any lessons that belonged to this course
    setLessons((prev) => prev.map((l) => l.courseId === id ? { ...l, courseId: undefined } : l));
  }

  async function handleDuplicate(course: Course) {
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Copy of ${course.title}`,
        description: course.description,
        gradeLevel: course.gradeLevel,
        term: course.term,
        settings: course.settings,
        lessonIds: [],
      }),
    });
    if (res.ok) {
      const copy = await res.json();
      setCourses((prev) => [copy, ...prev]);
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    setLessons(prev => prev.filter(l => l.id !== lessonId));
  }

  async function handleDuplicateLesson(lessonId: string) {
    const lesson = await fetch(`/api/lessons/${lessonId}`).then(r => r.json());
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lesson, title: `Copy of ${lesson.title}`, id: undefined, status: "draft" }),
    });
    if (res.ok) {
      const copy = await res.json();
      setLessons(prev => [copy, ...prev]);
    }
  }

  // ── Sorted courses ──────────────────────────────────────────────────────────
  const sortedCourses: Course[] = (() => {
    const orderedIds = courseOrder.filter(id => courses.some(c => c.id === id));
    const unordered = courses.filter(c => !courseOrder.includes(c.id));
    const ordered = orderedIds.map(id => courses.find(c => c.id === id)!);
    return [...ordered, ...unordered];
  })();

  // ── Sorted lessons ──────────────────────────────────────────────────────────
  const sortedLessons: Lesson[] = (() => {
    const orderedIds = lessonOrder.filter(id => lessons.some(l => l.id === id));
    const unordered = lessons.filter(l => !lessonOrder.includes(l.id));
    const ordered = orderedIds.map(id => lessons.find(l => l.id === id)!);
    return [...ordered, ...unordered];
  })();

  const filteredLessons = sortedLessons.filter(l => {
    if (filterCourse === "unassigned" && l.courseId) return false;
    if (filterCourse !== "all" && filterCourse !== "unassigned" && l.courseId !== filterCourse) return false;
    if (filterStatus === "draft" && l.status !== "draft") return false;
    if (filterStatus === "done" && l.status !== "done") return false;
    return true;
  });

  function handleCourseDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedCourses.findIndex(c => c.id === active.id);
    const newIndex = sortedCourses.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newSorted = arrayMove(sortedCourses, oldIndex, newIndex);
    const newOrder = newSorted.map(c => c.id);
    setCourseOrder(newOrder);
    localStorage.setItem("sort-courses", JSON.stringify(newOrder));
  }

  function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedLessons.findIndex(l => l.id === active.id);
    const newIndex = sortedLessons.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newSorted = arrayMove(sortedLessons, oldIndex, newIndex);
    const newOrder = newSorted.map(l => l.id);
    setLessonOrder(newOrder);
    localStorage.setItem("sort-lessons-cp", JSON.stringify(newOrder));
  }

  return (
    <div className="space-y-8">
      {/* ── Courses ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Curriculum</p>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Courses</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Organize lessons into courses with independent settings.</p>
          </div>
          <Link href="/courses/new" className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition shadow">
            + New Course
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[#0cc0df]">Loading…</p>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-12 h-12 rounded-3xl bg-[#0cc0df]/10 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No courses yet</p>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Create a course to organize lessons with shared settings.</p>
            <Link href="/courses/new" className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
              Create your first course
            </Link>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCourseDragEnd}>
            <SortableContext items={sortedCourses.map(c => c.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedCourses.map((course) => (
                  <SortableCourseCard key={course.id} course={course} onDelete={handleDelete} onDuplicate={handleDuplicate} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ── Lessons ──────────────────────────────────────────────────────────── */}
      {!loading && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>All Lessons</p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </p>
            </div>
            <Link
              href="/lessons/new"
              className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition shadow"
            >
              + New Lesson
            </Link>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
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

          {filteredLessons.length === 0 ? (
            <div className="text-center py-12 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {filterCourse === "unassigned" ? "All lessons are assigned to a course." : "No lessons yet."}
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
              <SortableContext items={sortedLessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {filteredLessons.map((lesson, i) => (
                    <SortableLessonRow
                      key={lesson.id}
                      lesson={lesson}
                      projects={projects.filter(p => p.lessonId === lesson.id || p.lessonIds?.includes(lesson.id))}
                      courses={courses}
                      isFirst={i === 0}
                      isLast={i === filteredLessons.length - 1}
                      onDelete={handleDeleteLesson}
                      onDuplicate={handleDuplicateLesson}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}
