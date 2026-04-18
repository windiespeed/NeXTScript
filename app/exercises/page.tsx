"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Exercise, ExerciseType } from "@/types/exercise";
import type { Concept } from "@/types/concept";

function slugToLabel(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const DIFFICULTY_COLOR: Record<string, { bg: string; text: string }> = {
  beginner:     { bg: "rgba(45,212,160,0.12)",  text: "#2dd4a0" },
  intermediate: { bg: "rgba(255,140,74,0.12)",  text: "#ff8c4a" },
  advanced:     { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
};

function ExerciseCard({ exercise, onDelete }: { exercise: Exercise; onDelete: (id: string) => void }) {
  const diff = DIFFICULTY_COLOR[exercise.difficulty];
  const isChallenge = exercise.type === "challenge";

  return (
    <div
      className="group relative rounded-3xl p-5 space-y-3 hover:-translate-y-1 transition-all duration-200"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>
            {exercise.title}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            {exercise.tests.length} test{exercise.tests.length !== 1 ? "s" : ""}
            {exercise.hints.length > 0 && ` · ${exercise.hints.length} hint${exercise.hints.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isChallenge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent-purple)" }}>
              CHALLENGE
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: diff.bg, color: diff.text }}>
            {exercise.difficulty}
          </span>
        </div>
      </div>

      {exercise.description && (
        <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
          {exercise.description.replace(/`/g, "").split("\n")[0]}
        </p>
      )}

      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Order #{exercise.order}
        </span>
        <div className="flex gap-2 items-center">
          <Link
            href={`/exercises/${exercise.id}`}
            className="text-xs font-semibold px-3 py-1 rounded-full transition hover:opacity-80"
            style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Edit
          </Link>
          <button
            onClick={() => onDelete(exercise.id)}
            className="text-xs font-semibold px-3 py-1 rounded-full transition hover:opacity-80"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  useSession({ required: true });

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [filterType, setFilterType] = useState<"all" | ExerciseType>("all");
  const [filterConcept, setFilterConcept] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/exercises").then(r => r.json()),
      fetch("/api/concepts").then(r => r.json()),
    ]).then(([ex, con]) => {
      setExercises(Array.isArray(ex) ? ex : []);
      setConcepts(Array.isArray(con) ? con : []);
      setLoading(false);
    });
  }, []);

  async function handleSeed() {
    setSeeding(true);
    const res = await fetch("/api/exercises/seed", { method: "POST" });
    const data = await res.json();
    if (data.seeded > 0) {
      const fresh = await fetch("/api/exercises").then(r => r.json());
      setExercises(Array.isArray(fresh) ? fresh : []);
    }
    setSeeding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this exercise?")) return;
    await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    setExercises(prev => prev.filter(e => e.id !== id));
  }

  const filtered = exercises.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterConcept !== "all" && e.concept !== filterConcept) return false;
    return true;
  });

  // Group filtered exercises by concept — order by concepts array, then unknown slugs at end
  const conceptSlugsInUse = [...new Set(filtered.map(e => e.concept))];
  const conceptsInUse = [
    ...concepts.filter(c => conceptSlugsInUse.includes(c.slug)),
    ...conceptSlugsInUse
      .filter(s => !concepts.some(c => c.slug === s))
      .map(s => ({ id: s, slug: s, label: slugToLabel(s), description: "", order: 9999, teacherId: "", createdAt: "", updatedAt: "" })),
  ];

  const totalCount = exercises.length;
  const challengeCount = exercises.filter(e => e.type === "challenge").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Exercises</h1>
          {!loading && totalCount > 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {totalCount} exercise{totalCount !== 1 ? "s" : ""} · {challengeCount} challenge{challengeCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {totalCount === 0 && !loading && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent-purple)", border: "1px solid rgba(99,102,241,0.35)" }}
            >
              {seeding ? "Seeding…" : "Seed Starter Exercises"}
            </button>
          )}
          <Link
            href="/exercises/new"
            className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{ background: "#0cc0df", color: "#0a0b13" }}
          >
            + New Exercise
          </Link>
        </div>
      </div>

      {/* Filter pills */}
      {!loading && totalCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["all", "exercise", "challenge"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={filterType === f
                ? { background: "#0cc0df", color: "#0a0b13" }
                : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
            </button>
          ))}

          <span className="self-center text-xs" style={{ color: "var(--border)" }}>|</span>

          <button
            onClick={() => setFilterConcept("all")}
            className="rounded-full px-3 py-1 text-xs font-medium transition"
            style={filterConcept === "all"
              ? { background: "#0cc0df", color: "#0a0b13" }
              : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            All Concepts
          </button>
          {conceptsInUse.map(c => (
            <button
              key={c.slug}
              onClick={() => setFilterConcept(c.slug)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={filterConcept === c.slug
                ? { background: "rgba(99,102,241,0.2)", color: "var(--accent-purple)", border: "1px solid rgba(99,102,241,0.4)" }
                : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : totalCount === 0 ? (
        <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No exercises yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Seed the 65 starter JavaScript exercises or create your own.
          </p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-full px-5 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "#0cc0df", color: "#0a0b13" }}
          >
            {seeding ? "Seeding…" : "Seed Starter Exercises"}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No exercises match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {conceptsInUse.map(concept => {
            const conceptExercises = filtered
              .filter(e => e.concept === concept.slug)
              .sort((a, b) => a.order - b.order);
            const exerciseItems = conceptExercises.filter(e => e.type === "exercise");
            const challengeItems = conceptExercises.filter(e => e.type === "challenge");

            return (
              <div key={concept.slug}>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                    {concept.label}
                  </h2>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>
                    {exerciseItems.length} exercise{exerciseItems.length !== 1 ? "s" : ""}
                    {challengeItems.length > 0 && ` · ${challengeItems.length} challenge${challengeItems.length !== 1 ? "s" : ""}`}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                </div>
                {concept.description && (
                  <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{concept.description}</p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {conceptExercises.map(exercise => (
                    <ExerciseCard key={exercise.id} exercise={exercise} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
