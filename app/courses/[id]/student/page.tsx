"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Lesson } from "@/types/lesson";

interface PublicCourse {
  id: string;
  title: string;
  description?: string;
  gradeLevel?: string;
  term?: string;
  subject?: string;
  industry?: string;
  lessons: Pick<Lesson, "id" | "title" | "subtitle" | "topics" | "deadline" | "tag" | "status" | "folderUrl">[];
}

export default function StudentCoursePage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<PublicCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/public/courses/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) { setCourse(data); setLoading(false); }
      });
  }, [id]);

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading course…</p>;

  if (notFound || !course) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Course not found.</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>This course may not exist or no lessons have been released yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#08090f] from-30% to-[#0cc0df]/30 px-6 py-6 shadow" style={{ border: "1px solid rgba(12,192,223,0.2)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#0cc0df]/70 mb-2">Student View</p>
        <h1 className="text-2xl font-bold text-white">{course.title}</h1>
        {course.description && (
          <p className="text-sm text-white/60 mt-1 max-w-xl">{course.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {course.subject && (
            <span className="rounded-xl bg-white/10 px-2.5 py-0.5 text-xs text-white/80">{course.subject}</span>
          )}
          {course.gradeLevel && (
            <span className="rounded-xl bg-white/10 px-2.5 py-0.5 text-xs text-white/80">{course.gradeLevel}</span>
          )}
          {course.term && (
            <span className="rounded-xl bg-white/10 px-2.5 py-0.5 text-xs text-white/80">{course.term}</span>
          )}
          <span className="rounded-xl bg-[#2dd4a0]/20 px-2.5 py-0.5 text-xs text-[#2dd4a0]">
            {course.lessons.length} {course.lessons.length === 1 ? "lesson" : "lessons"} released
          </span>
        </div>
      </div>

      {/* Lessons */}
      {course.lessons.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="w-12 h-12 rounded-xl bg-[#0cc0df]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No lessons released yet</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Check back soon — your instructor will release lessons as the course progresses.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-label)" }}>
            Course Lessons
          </p>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {course.lessons.map((lesson, i) => (
              <div
                key={lesson.id}
                className="flex items-start gap-4 px-5 py-4"
                style={{
                  background: "var(--bg-card)",
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                {/* Number bubble */}
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: "var(--accent-bg)", color: "#0cc0df" }}
                >
                  {i + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                  {lesson.subtitle && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{lesson.subtitle}</p>
                  )}
                  {lesson.topics && (
                    <p className="text-xs mt-2 line-clamp-2 text-[#0cc0df]">{lesson.topics}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {lesson.deadline && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Due <span className="font-medium" style={{ color: "var(--text-primary)" }}>{lesson.deadline}</span>
                      </span>
                    )}
                    {lesson.tag && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#0cc0df]" style={{ background: "var(--accent-bg)" }}>
                        {lesson.tag}
                      </span>
                    )}
                  </div>
                </div>

                {/* Drive folder link */}
                {lesson.folderUrl && (
                  <a
                    href={lesson.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0cc0df] hover:bg-[#0cc0df]/10 transition"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Open ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs pt-2 pb-4" style={{ color: "var(--text-muted)" }}>
        Powered by NeXTScript · mscoding.org
      </p>
    </div>
  );
}
