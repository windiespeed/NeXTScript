"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Lesson } from "@/types/lesson";
import type { Course } from "@/types/course";
import type { SavedProject } from "@/types/project";

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

function SlideCard({
  lesson,
  courses,
  deckCount,
  assigningOpen,
  onToggleAssign,
  onAssign,
}: {
  lesson: Lesson;
  courses: Course[];
  deckCount: number;
  assigningOpen: boolean;
  onToggleAssign: (id: string) => void;
  onAssign: (lessonId: string, courseId: string | null) => void;
}) {
  const course = courses.find(c => c.id === lesson.courseId);
  const s = STATUS_COLOR[lesson.status];

  return (
    <div
      className="group relative rounded-3xl p-5 space-y-3 hover:-translate-y-1 transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>
            {lesson.title}
          </p>
          {lesson.subtitle && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{lesson.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {deckCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(12,192,223,0.12)", color: "#0cc0df" }}>
              {deckCount} deck{deckCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>
            {s.label}
          </span>
        </div>
      </div>

      {/* Course assignment dropdown */}
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
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "done">("all");
  const [assigningLessonId, setAssigningLessonId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/lessons").then(r => r.json()),
      fetch("/api/drive").then(r => r.json()),
      fetch("/api/projects").then(r => r.json()),
    ]).then(([l, c, p]) => {
      setLessons(Array.isArray(l) ? l : []);
      setCourses(Array.isArray(c) ? c : []);
      setProjects(Array.isArray(p) ? p : []);
      setLoading(false);
    });
  }, []);

  // Apply status filter
  const statusFiltered = lessons.filter(l => {
    if (filterStatus === "draft" && l.status !== "draft") return false;
    if (filterStatus === "done" && l.status !== "done") return false;
    return true;
  });

  // Build course-grouped sections, ordering lessons by course.lessonIds
  const courseSections: { course: Course | null; lessons: Lesson[] }[] = (() => {
    const sections: { course: Course | null; lessons: Lesson[] }[] = [];

    const orderLessons = (course: Course, lessonList: Lesson[]) => {
      const orderMap = new Map(course.lessonIds.map((id, i) => [id, i]));
      return [...lessonList].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
    };

    if (filterCourse === "unassigned") {
      const unassigned = statusFiltered.filter(l => !l.courseId);
      if (unassigned.length > 0) sections.push({ course: null, lessons: unassigned });
      return sections;
    }

    const coursesToShow = filterCourse === "all" ? courses : courses.filter(c => c.id === filterCourse);

    coursesToShow.forEach(course => {
      const courseLessons = statusFiltered.filter(l => l.courseId === course.id);
      if (courseLessons.length > 0) sections.push({ course, lessons: orderLessons(course, courseLessons) });
    });

    if (filterCourse === "all") {
      const unassigned = statusFiltered.filter(l => !l.courseId);
      if (unassigned.length > 0) sections.push({ course: null, lessons: unassigned });
    }

    return sections;
  })();

  const totalFiltered = courseSections.reduce((sum, s) => sum + s.lessons.length, 0);

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
        await fetch(`/api/drive/${oldCourseId}`, {
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
        await fetch(`/api/drive/${newCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: [...newCourse.lessonIds, lessonId] }),
        });
        setCourses(prev => prev.map(c => c.id === newCourseId ? { ...c, lessonIds: [...c.lessonIds, lessonId] } : c));
      }
    }

    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, courseId: newCourseId ?? undefined, released: false } : l));
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

      {/* Content */}
      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : totalFiltered === 0 ? (
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
        <div className="space-y-8" onClick={() => setAssigningLessonId(null)}>
          {courseSections.map(({ course, lessons: sectionLessons }) => (
            <div key={course?.id ?? "unassigned"}>
              {/* Course section header */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                  {course?.title ?? "Unassigned"}
                </h2>
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  {sectionLessons.length} lesson{sectionLessons.length !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sectionLessons.map(lesson => (
                  <SlideCard
                    key={lesson.id}
                    lesson={lesson}
                    courses={courses}
                    deckCount={projects.filter(p => p.type === "deck" && p.lessonId === lesson.id).length}
                    assigningOpen={assigningLessonId === lesson.id}
                    onToggleAssign={id => setAssigningLessonId(prev => prev === id ? null : id)}
                    onAssign={handleAssignLesson}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
