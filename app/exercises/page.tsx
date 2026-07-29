"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Exercise } from "@/types/exercise";
import type { Course } from "@/types/course";

const DIFFICULTY_COLOR: Record<string, { bg: string; text: string }> = {
  beginner:     { bg: "rgba(45,212,160,0.12)",  text: "#2dd4a0" },
  intermediate: { bg: "rgba(255,140,74,0.12)",  text: "#ff8c4a" },
  advanced:     { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
};

const inputClass = "rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

function ExerciseRow({
  exercise, courses, selected, onToggle, onAssign, onDelete,
}: {
  exercise: Exercise;
  courses: Course[];
  selected: boolean;
  onToggle: (id: string) => void;
  onAssign: (id: string, courseId: string) => void;
  onDelete: (id: string) => void;
}) {
  const diff = DIFFICULTY_COLOR[exercise.difficulty];
  const [courseId, setCourseId] = useState("");

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3 flex-wrap"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <input type="checkbox" checked={selected} onChange={() => onToggle(exercise.id)} className="shrink-0" />
      <div className="flex-1 min-w-[160px]">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{exercise.title}</p>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {exercise.concept} · {exercise.type}
        </p>
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: diff.bg, color: diff.text }}>
        {exercise.difficulty}
      </span>
      <select value={courseId} onChange={e => setCourseId(e.target.value)} className={inputClass} style={inputStyle}>
        <option value="">Assign to course…</option>
        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <button
        onClick={() => courseId && onAssign(exercise.id, courseId)}
        disabled={!courseId}
        className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 disabled:opacity-50 shrink-0"
        style={{ background: "#0cc0df", color: "#0a0b13" }}
      >
        Assign
      </button>
      <Link
        href={`/exercises/${exercise.id}`}
        className="text-xs font-semibold px-3 py-1.5 rounded-full transition hover:opacity-80 shrink-0"
        style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
      >
        Edit
      </Link>
      <button
        onClick={() => onDelete(exercise.id)}
        className="text-xs font-semibold px-3 py-1.5 rounded-full transition hover:opacity-80 shrink-0"
        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        Delete
      </button>
    </div>
  );
}

export default function UnassignedExercisesPage() {
  useSession({ required: true });

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [ex, co] = await Promise.all([
      fetch("/api/exercises").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]);
    setExercises(Array.isArray(ex) ? ex : []);
    setCourses(Array.isArray(co) ? co : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function assignOne(id: string, courseId: string) {
    setError("");
    const res = await fetch(`/api/exercises/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to assign exercise.");
      return;
    }
    setExercises(prev => prev.filter(e => e.id !== id));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  async function handleBulkAssign() {
    if (!bulkCourseId || selected.size === 0) return;
    setAssigning(true);
    setError("");
    const ids = Array.from(selected);
    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/exercises/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: bulkCourseId }),
        });
        return { id, ok: res.ok };
      })
    );
    const succeeded = new Set(results.filter(r => r.ok).map(r => r.id));
    const failedCount = results.length - succeeded.size;
    if (failedCount > 0) {
      setError(`${failedCount} exercise${failedCount !== 1 ? "s" : ""} failed to assign.`);
    }
    setExercises(prev => prev.filter(e => !succeeded.has(e.id)));
    setSelected(prev => {
      const next = new Set(prev);
      succeeded.forEach(id => next.delete(id));
      return next;
    });
    setBulkCourseId("");
    setAssigning(false);
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this exercise?")) return;
    await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    setExercises(prev => prev.filter(e => e.id !== id));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Unassigned Exercises</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Exercises created before per-course scoping — assign each one to the course it belongs to. Exercises are
          now created and managed from within a course's own Exercises page.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : exercises.length === 0 ? (
        <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Nothing to assign</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Every exercise is assigned to a course. Manage exercises from inside each course.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 flex-wrap" style={{ background: "var(--accent-bg)", border: "1px solid rgba(12,192,223,0.3)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {selected.size} selected
            </span>
            <select value={bulkCourseId} onChange={e => setBulkCourseId(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">Assign selected to course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkCourseId || selected.size === 0 || assigning}
              className="rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "#0cc0df", color: "#0a0b13" }}
            >
              {assigning ? "Assigning…" : "Assign Selected"}
            </button>
          </div>

          <div className="space-y-2">
            {exercises.map(exercise => (
              <ExerciseRow
                key={exercise.id}
                exercise={exercise}
                courses={courses}
                selected={selected.has(exercise.id)}
                onToggle={toggle}
                onAssign={assignOne}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
