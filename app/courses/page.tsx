"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Course } from "@/types/course";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function CourseCard({ course, onDelete, onDuplicate }: { course: Course; onDelete: (id: string) => void; onDuplicate: (course: Course) => void }) {
  return (
    <div
      className="h-full rounded-2xl flex flex-col overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-base leading-snug" style={{ color: "var(--text-primary)" }}>
            {course.title}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {course.settings?.studentLevel && (
              <span className="rounded-xl px-2.5 py-0.5 text-[10px] font-semibold text-[#0cc0df] capitalize" style={{ background: "var(--accent-bg)" }}>
                {course.settings.studentLevel}
              </span>
            )}
            <button
              onClick={() => onDuplicate(course)}
              title="Duplicate course"
              className="p-1.5 rounded-lg transition hover:bg-[var(--bg-card-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>
        {course.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {course.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {course.settings?.subject && (
            <span className="rounded-xl px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
              {course.settings.subject}
            </span>
          )}
          {course.gradeLevel && (
            <span className="rounded-xl px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
              {course.gradeLevel}
            </span>
          )}
          {course.term && (
            <span className="rounded-xl px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
              {course.term}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xs font-semibold text-[#0cc0df]">
            {course.lessonIds.length} {course.lessonIds.length === 1 ? "lesson" : "lessons"}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Created {fmt(course.createdAt)}</span>
        </div>
      </div>
      <div className="flex gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card-hover)" }}>
        <Link href={`/courses/${course.id}`} className="flex-1 flex items-center justify-center rounded-xl bg-[#0cc0df] px-3 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 active:scale-95 transition-all">
          Open
        </Link>
        <button onClick={() => onDelete(course.id)} className="flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 active:scale-95 transition-all" style={{ border: "1px solid var(--border)" }}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  useSession({ required: true });
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then((data) => {
      setCourses(Array.isArray(data) ? data : []);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Curriculum</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Courses</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Organize lessons into courses with independent settings.</p>
        </div>
        <Link href="/courses/new" className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition shadow">
          + New Course
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-12 h-12 rounded-2xl bg-[#0cc0df]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No courses yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Create a course to organize lessons with shared settings.</p>
          <Link href="/courses/new" className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
            Create your first course
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => <CourseCard key={course.id} course={course} onDelete={handleDelete} onDuplicate={handleDuplicate} />)}
        </div>
      )}
    </div>
  );
}
