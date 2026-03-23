"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Course } from "@/types/course";
import type { SavedProject } from "@/types/project";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function QuizzesPage() {
  useSession({ required: true });

  const [quizzes, setQuizzes] = useState<SavedProject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "generated">("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/quizzes").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]).then(([q, c]) => {
      setQuizzes(Array.isArray(q) ? q : []);
      setCourses(Array.isArray(c) ? c : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setQuizzes(prev => prev.filter(q => q.id !== id));
  }

  const filtered = quizzes.filter(q => {
    if (filterCourse !== "all" && filterCourse !== "unassigned") {
      if (q.courseId !== filterCourse) return false;
    }
    if (filterCourse === "unassigned" && q.courseId) return false;
    if (filterStatus === "draft" && q.status !== "draft") return false;
    if (filterStatus === "generated" && q.status === "draft") return false;
    return true;
  });

  const hasCourseFilter = courses.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Content</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Quizzes</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Build and manage quiz drafts for your lessons.
          </p>
        </div>
        <Link
          href="/quizzes/new"
          className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition shadow"
        >
          + New Quiz
        </Link>
      </div>

      {/* Filter pills */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          {/* Status filters */}
          {(["all", "draft", "generated"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={filterStatus === f
                ? { background: "#0cc0df", color: "#0a0b13" }
                : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {f === "all" ? "All" : f === "draft" ? "Drafts" : "Generated"}
            </button>
          ))}

          {/* Course filters */}
          {hasCourseFilter && (
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
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No quizzes yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Create a quiz draft to get started.</p>
          <Link
            href="/quizzes/new"
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Create your first quiz
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(quiz => {
            const course = courses.find(c => c.id === quiz.courseId);
            const isDraft = quiz.status === "draft" || !quiz.url;
            return (
              <div
                key={quiz.id}
                className="rounded-3xl p-5 space-y-3 hover:-translate-y-1 transition-all duration-200"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>
                      {quiz.title}
                    </p>
                    {(quiz.lessonIds?.length > 0 || quiz.questions?.length > 0) && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                        {[
                          quiz.lessonIds?.length > 0 ? `${quiz.lessonIds.length} lesson${quiz.lessonIds.length !== 1 ? "s" : ""}` : null,
                          quiz.questions?.length > 0 ? `${quiz.questions.length} question${quiz.questions.length !== 1 ? "s" : ""}` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={isDraft
                      ? { background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                      : { background: "rgba(45,212,160,0.12)", color: "#2dd4a0" }
                    }
                  >
                    {isDraft ? "Draft" : "Generated"}
                  </span>
                </div>

                {course && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    {course.title}
                  </span>
                )}

                <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {fmt(quiz.createdAt)}
                  </span>
                  <div className="flex gap-2">
                    {!isDraft && quiz.url && (
                      <a
                        href={quiz.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full px-3 py-1 text-xs font-semibold transition"
                        style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                      >
                        Open ↗
                      </a>
                    )}
                    {isDraft && (
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="rounded-full bg-[#0cc0df] px-3 py-1 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition"
                      >
                        Edit
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(quiz.id)}
                      title="Delete quiz"
                      className="p-1.5 rounded-full transition hover:text-red-500 hover:bg-red-500/10"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
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
