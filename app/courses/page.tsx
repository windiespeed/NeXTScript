"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Course } from "@/types/course";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";
import LessonCard from "@/components/LessonCard";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function CourseCard({ course, onDelete, onDuplicate }: { course: Course; onDelete: (id: string) => void; onDuplicate: (course: Course) => void }) {
  return (
    <div
      className="group h-full rounded-3xl flex flex-col hover:-translate-y-1 transition-all duration-200"
      style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
    >
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

export default function CoursesPage() {
  useSession({ required: true });
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState<string>("all");

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

  const filteredLessons = filterCourse === "all"
    ? lessons
    : filterCourse === "unassigned"
    ? lessons.filter(l => !l.courseId)
    : lessons.filter(l => l.courseId === filterCourse);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => <CourseCard key={course.id} course={course} onDelete={handleDelete} onDuplicate={handleDuplicate} />)}
          </div>
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
          {courses.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(["all", "unassigned"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterCourse(f)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition"
                  style={filterCourse === f
                    ? { background: "#0cc0df", color: "#0a0b13" }
                    : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  {f === "all" ? "All" : "Unassigned"}
                </button>
              ))}
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
            </div>
          )}

          {filteredLessons.length === 0 ? (
            <div className="text-center py-12 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {filterCourse === "unassigned" ? "All lessons are assigned to a course." : "No lessons yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLessons.map(lesson => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  projects={projects.filter(p => p.lessonId === lesson.id || p.lessonIds?.includes(lesson.id))}
                  courses={courses}
                  onDelete={handleDeleteLesson}
                  onDuplicate={handleDuplicateLesson}
                  onOpenModal={() => router.push(`/lessons/${lesson.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
