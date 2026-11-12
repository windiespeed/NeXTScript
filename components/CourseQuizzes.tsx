"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SavedProject } from "@/types/project";
import type { Lesson } from "@/types/lesson";
import type { CourseModule } from "@/types/course";

/** True when a quiz belongs to this course: scoped to it directly, or linked to one of its lessons. */
export function quizInCourse(q: SavedProject, courseId: string, courseLessonIds: Set<string>): boolean {
  if (q.courseId) return q.courseId === courseId;
  if (q.lessonId && courseLessonIds.has(q.lessonId)) return true;
  return (q.lessonIds ?? []).some(id => courseLessonIds.has(id));
}

function scopeLabel(q: SavedProject, lessons: Lesson[], modules: CourseModule[]): string {
  const ids = q.lessonIds?.length ? q.lessonIds : q.lessonId ? [q.lessonId] : [];
  if (ids.length === 1) return lessons.find(l => l.id === ids[0])?.title ?? "One lesson";
  if (q.moduleId) {
    const mod = modules.find(m => m.id === q.moduleId);
    if (mod) return `Module: ${mod.title}`;
  }
  if (ids.length > 1) return `${ids.length} lessons`;
  return "Course-wide";
}

/**
 * The course's quizzes, listed on the course page. Quizzes have no menu of their own, so
 * this is where course-wide, module and standalone quizzes (which no lesson page shows) are reached.
 */
export default function CourseQuizzes({ courseId, lessons, modules }: { courseId: string; lessons: Lesson[]; modules: CourseModule[] }) {
  const [quizzes, setQuizzes] = useState<SavedProject[] | null>(null);

  useEffect(() => {
    fetch("/api/quizzes")
      .then(r => r.json())
      .then(data => setQuizzes(Array.isArray(data) ? data : []))
      .catch(() => setQuizzes([]));
  }, [courseId]);

  const lessonIds = new Set(lessons.map(l => l.id));
  const courseQuizzes = (quizzes ?? [])
    .filter(q => quizInCourse(q, courseId, lessonIds))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="rounded-3xl p-4 space-y-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Quizzes{quizzes && courseQuizzes.length > 0 ? ` (${courseQuizzes.length})` : ""}
        </p>
        <Link href={`/quizzes/new?courseId=${courseId}`}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--accent-bg)]"
          style={{ color: "var(--accent-text)" }}>
          + New Quiz
        </Link>
      </div>
      {quizzes === null ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading quizzes…</p>
      ) : courseQuizzes.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No quizzes in this course yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {courseQuizzes.map(q => {
            const isDraft = q.status === "draft" || (!q.status && !q.url);
            return (
              <li key={q.id} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={isDraft
                    ? { background: "rgba(255,140,74,0.12)", color: "var(--warning-text)" }
                    : { background: "rgba(45,212,160,0.12)", color: "var(--success-text)" }}>
                  {isDraft ? "Draft" : "Quiz"}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/quizzes/${q.id}`} className="block text-sm font-semibold truncate hover:underline" style={{ color: "var(--text-primary)" }}>
                    {q.title}
                  </Link>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{scopeLabel(q, lessons, modules)}</p>
                </div>
                {q.url && (
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
                    Open Form ↗
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
