"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Concept } from "@/types/concept";
import type { Course } from "@/types/course";

export default function ConceptsOverviewPage() {
  useSession({ required: true });
  const [courses, setCourses] = useState<Course[]>([]);
  const [conceptsByCourse, setConceptsByCourse] = useState<Record<string, Concept[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/courses").then(r => r.json()).then(async (courseList: Course[]) => {
      if (!Array.isArray(courseList)) { setLoading(false); return; }
      setCourses(courseList);
      const entries = await Promise.all(
        courseList.map(course =>
          fetch(`/api/concepts?courseId=${course.id}`)
            .then(r => r.json())
            .then((cons: Concept[]) => [course.id, Array.isArray(cons) ? cons : []] as [string, Concept[]])
        )
      );
      setConceptsByCourse(Object.fromEntries(entries));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: "#0cc0df" }}>Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Concepts</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Each course has its own set of topic categories. Click a course to manage its concepts.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-3xl p-8 text-center space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No courses yet</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Create a course first, then add concepts to it.</p>
          <Link href="/courses/new"
            className="inline-block rounded-full px-5 py-2 text-xs font-bold transition hover:opacity-90"
            style={{ background: "#0cc0df", color: "#0a0b13" }}>
            Create a Course
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map(course => {
            const cons = conceptsByCourse[course.id] ?? [];
            return (
              <div key={course.id} className="rounded-3xl p-4 flex items-start gap-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{course.title}</p>
                  {cons.length === 0 ? (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>No concepts yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {cons.slice(0, 6).map(c => (
                        <span key={c.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(12,192,223,0.1)", color: "#0cc0df" }}>
                          {c.label}
                        </span>
                      ))}
                      {cons.length > 6 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: "var(--text-muted)", background: "var(--bg-card-hover)" }}>
                          +{cons.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Link href={`/courses/${course.id}/settings`}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold transition hover:opacity-80 shrink-0"
                  style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  Manage
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
