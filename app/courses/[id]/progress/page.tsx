"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Exercise } from "@/types/exercise";
import type { Course } from "@/types/course";

interface ProgressRecord {
  studentId: string;
  exerciseId: string;
  status: "completed" | "in_progress";
}

interface DashboardData {
  course: Course;
  exercises: Exercise[];
  progress: ProgressRecord[];
}

function StatusCell({ status }: { status: "completed" | "in_progress" | "not_started" }) {
  if (status === "completed") {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center mx-auto" style={{ background: "var(--success-bg)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2dd4a0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(251,191,36,0.15)" }}>
        <div className="w-2 h-2 rounded-full" style={{ background: "#fbbf24" }} />
      </div>
    );
  }
  return <div className="w-7 h-7 rounded-full mx-auto" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }} />;
}

export default function CourseProgressPage() {
  useSession({ required: true });
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/courses/${id}/progress`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: "#0cc0df" }}>Loading…</div>;
  if (error) return <div className="py-20 text-center text-sm" style={{ color: "#ef4444" }}>{error}</div>;
  if (!data) return null;

  const { course, exercises, progress } = data;
  const studentIds = ((course.studentIds?.length ? course.studentIds : [...new Set(progress.map(p => p.studentId))]) as string[]).sort();

  const lookup: Record<string, Record<string, "completed" | "in_progress">> = {};
  progress.forEach(p => {
    if (!lookup[p.studentId]) lookup[p.studentId] = {};
    lookup[p.studentId][p.exerciseId] = p.status;
  });

  const conceptOrder: string[] = [];
  const conceptGroups: Record<string, Exercise[]> = {};
  exercises.forEach(e => {
    if (!conceptGroups[e.concept]) {
      conceptGroups[e.concept] = [];
      conceptOrder.push(e.concept);
    }
    conceptGroups[e.concept].push(e);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={`/courses/${id}`} className="text-sm hover:underline" style={{ color: "#0cc0df" }}>← {course.title}</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Student Progress</span>
      </div>

      {studentIds.length === 0 ? (
        <div className="rounded-3xl p-8 text-center space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No students yet</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Students will appear here once they join using the course join code.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10 min-w-[180px]"
                    style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>
                    Student
                  </th>
                  {conceptOrder.map(concept => (
                    <th key={concept} colSpan={conceptGroups[concept].length}
                      className="px-2 py-3 font-semibold text-center border-l"
                      style={{ color: "#0cc0df", borderColor: "var(--border)" }}>
                      {concept.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-semibold text-center border-l min-w-[80px]"
                    style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                    Score
                  </th>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="sticky left-0 z-10 px-4 py-2" style={{ background: "var(--bg-card)" }} />
                  {exercises.map(ex => (
                    <th key={ex.id} className="px-1 py-2 border-l min-w-[36px]"
                      style={{ borderColor: "var(--border)" }}>
                      <div className="w-7 mx-auto text-center leading-tight" style={{ color: "var(--text-muted)" }}
                        title={ex.title}>
                        {ex.order}
                        {ex.type === "challenge" && <span style={{ color: "#fbbf24" }}>★</span>}
                      </div>
                    </th>
                  ))}
                  <th className="border-l" style={{ borderColor: "var(--border)" }} />
                </tr>
              </thead>
              <tbody>
                {studentIds.map((studentId, si) => {
                  const studentMap = lookup[studentId] ?? {};
                  const completed = exercises.filter(e => studentMap[e.id] === "completed").length;
                  const pct = exercises.length > 0 ? Math.round((completed / exercises.length) * 100) : 0;
                  return (
                    <tr key={studentId}
                      style={{ borderBottom: si < studentIds.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td className="px-4 py-3 sticky left-0 z-10 font-medium" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                        <span className="block max-w-[160px] truncate" title={studentId}>{studentId}</span>
                      </td>
                      {exercises.map(ex => {
                        const s = studentMap[ex.id];
                        return (
                          <td key={ex.id} className="py-2 px-1 text-center border-l" style={{ borderColor: "var(--border)" }}>
                            <StatusCell status={s ?? "not_started"} />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center border-l" style={{ borderColor: "var(--border)" }}>
                        <span className="font-semibold" style={{ color: pct === 100 ? "#2dd4a0" : "var(--text-secondary)" }}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 flex items-center gap-5 flex-wrap" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {studentIds.length} student{studentIds.length !== 1 ? "s" : ""} · {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-4 ml-auto">
              {([
                { color: "#2dd4a0", bg: "var(--success-bg)", label: "Completed" },
                { color: "#fbbf24", bg: "rgba(251,191,36,0.15)", label: "In Progress" },
              ] as { color: string; bg: string; label: string }[]).map(({ color, bg, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: bg, border: `1px solid ${color}` }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Not Started</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: "#fbbf24" }}>★</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Challenge</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
