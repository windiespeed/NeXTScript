"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Lesson } from "@/types/lesson";
import type { Course } from "@/types/course";
import type { SavedProject } from "@/types/project";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function QuizCard({ quiz, onDelete }: { quiz: SavedProject; onDelete: (id: string) => void }) {
  const isDraft = quiz.status === "draft" || !quiz.url;

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
            {quiz.title}
          </p>
          {(quiz.questions?.length ?? 0) > 0 && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {quiz.questions!.length} question{quiz.questions!.length !== 1 ? "s" : ""}
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

      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {fmt(quiz.createdAt)}
        </span>
        <div className="flex gap-2 items-center">
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
            onClick={() => onDelete(quiz.id)}
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
}

type QuizWithContext = SavedProject & {
  effectiveCourseId?: string;
  effectiveLessonId?: string;
};

export default function QuizzesPage() {
  useSession({ required: true });

  const [quizzes, setQuizzes] = useState<SavedProject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "generated">("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/quizzes").then(r => r.json()),
      fetch("/api/drive").then(r => r.json()),
      fetch("/api/lessons").then(r => r.json()),
    ]).then(([q, c, l]) => {
      setQuizzes(Array.isArray(q) ? q : []);
      setCourses(Array.isArray(c) ? c : []);
      setLessons(Array.isArray(l) ? l : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setQuizzes(prev => prev.filter(q => q.id !== id));
  }

  // Attach effective courseId and lessonId to each quiz
  const quizzesWithContext: QuizWithContext[] = quizzes.map(quiz => {
    let effectiveLessonId = quiz.lessonId;
    if (!effectiveLessonId && quiz.lessonIds?.length === 1) {
      effectiveLessonId = quiz.lessonIds[0];
    }

    let effectiveCourseId = quiz.courseId;
    if (!effectiveCourseId && effectiveLessonId) {
      effectiveCourseId = lessons.find(l => l.id === effectiveLessonId)?.courseId;
    }
    if (!effectiveCourseId && quiz.lessonIds?.length) {
      effectiveCourseId = lessons.find(l => quiz.lessonIds!.includes(l.id))?.courseId;
    }

    return { ...quiz, effectiveCourseId, effectiveLessonId };
  });

  // Apply status filter
  const statusFiltered = quizzesWithContext.filter(q => {
    if (filterStatus === "draft" && q.status !== "draft") return false;
    if (filterStatus === "generated" && q.status === "draft") return false;
    return true;
  });

  type LessonGroup = { lessonId: string | null; lessonTitle: string; quizzes: QuizWithContext[] };
  type CourseSection = { course: Course | null; lessonGroups: LessonGroup[] };

  const buildLessonGroups = (quizzesInSection: QuizWithContext[]): LessonGroup[] => {
    const groupMap = new Map<string, LessonGroup>();
    quizzesInSection.forEach(q => {
      const key = q.effectiveLessonId ?? "__none__";
      if (!groupMap.has(key)) {
        const lesson = key !== "__none__" ? lessons.find(l => l.id === key) ?? null : null;
        groupMap.set(key, { lessonId: lesson?.id ?? null, lessonTitle: lesson?.title ?? "No lesson", quizzes: [] });
      }
      groupMap.get(key)!.quizzes.push(q);
    });
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.lessonId && !b.lessonId) return -1;
      if (!a.lessonId && b.lessonId) return 1;
      return a.lessonTitle.localeCompare(b.lessonTitle);
    });
  };

  const courseSections: CourseSection[] = (() => {
    const sections: CourseSection[] = [];

    if (filterCourse === "unassigned") {
      const unassigned = statusFiltered.filter(q => !q.effectiveCourseId);
      if (unassigned.length > 0) sections.push({ course: null, lessonGroups: buildLessonGroups(unassigned) });
      return sections;
    }

    const coursesToShow = filterCourse === "all" ? courses : courses.filter(c => c.id === filterCourse);
    coursesToShow.forEach(course => {
      const courseQuizzes = statusFiltered.filter(q => q.effectiveCourseId === course.id);
      if (courseQuizzes.length > 0) sections.push({ course, lessonGroups: buildLessonGroups(courseQuizzes) });
    });

    if (filterCourse === "all") {
      const unassigned = statusFiltered.filter(q => !q.effectiveCourseId);
      if (unassigned.length > 0) sections.push({ course: null, lessonGroups: buildLessonGroups(unassigned) });
    }

    return sections;
  })();

  const totalFiltered = courseSections.reduce((sum, s) => sum + s.lessonGroups.reduce((g, lg) => g + lg.quizzes.length, 0), 0);

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
        <div className="space-y-8">
          {courseSections.map(({ course, lessonGroups }) => (
            <div key={course?.id ?? "unassigned"}>
              {/* Course section header */}
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                  {course?.title ?? "Unassigned"}
                </h2>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              <div className="space-y-6">
                {lessonGroups.map(({ lessonId, lessonTitle, quizzes: groupQuizzes }) => (
                  <div key={lessonId ?? "__none__"}>
                    {/* Lesson sub-header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {lessonTitle}
                      </span>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}
                      >
                        {groupQuizzes.length} quiz{groupQuizzes.length !== 1 ? "zes" : ""}
                      </span>
                      <div className="flex-1 h-px" style={{ background: "var(--border)", opacity: 0.5 }} />
                      {lessonId && (
                        <Link
                          href={`/lessons/${lessonId}`}
                          className="text-[10px] transition hover:opacity-80"
                          style={{ color: "var(--text-muted)" }}
                        >
                          View lesson ↗
                        </Link>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {groupQuizzes.map(quiz => (
                        <QuizCard key={quiz.id} quiz={quiz} onDelete={handleDelete} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
