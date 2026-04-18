"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ExerciseDifficulty, ExerciseType, ExerciseTest } from "@/types/exercise";
import type { Concept } from "@/types/concept";
import { v4 as uuidv4 } from "uuid";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const textareaClass = `${inputClass} resize-none font-mono`;

export default function NewExercisePage() {
  useSession({ required: true });
  const router = useRouter();

  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [concept, setConcept] = useState<string>("");

  useEffect(() => {
    fetch("/api/concepts").then(r => r.json()).then(data => {
      const list: Concept[] = Array.isArray(data) ? data : [];
      setConcepts(list);
      if (list.length > 0) setConcept(list[0].slug);
    });
  }, []);
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>("beginner");
  const [type, setType] = useState<ExerciseType>("exercise");
  const [order, setOrder] = useState(1);
  const [starterCode, setStarterCode] = useState("function solution() {\n  // Your code here\n}");
  const [solution, setSolution] = useState("");
  const [hints, setHints] = useState<string[]>([""]);
  const [tests, setTests] = useState<ExerciseTest[]>([
    { id: uuidv4(), description: "", code: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addHint() { setHints(prev => [...prev, ""]); }
  function updateHint(i: number, val: string) { setHints(prev => prev.map((h, idx) => idx === i ? val : h)); }
  function removeHint(i: number) { setHints(prev => prev.filter((_, idx) => idx !== i)); }

  function addTest() { setTests(prev => [...prev, { id: uuidv4(), description: "", code: "" }]); }
  function updateTest(i: number, field: keyof ExerciseTest, val: string) {
    setTests(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  }
  function removeTest(i: number) { setTests(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        concept,
        difficulty,
        type,
        order,
        language: "javascript",
        starterCode,
        solution,
        hints: hints.filter(h => h.trim()),
        tests: tests.filter(t => t.description.trim() && t.code.trim()),
        isSeeded: false,
      }),
    });
    if (res.ok) {
      router.push("/exercises");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/exercises" className="text-sm hover:underline" style={{ color: "#0cc0df" }}>
          ← Exercises
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Exercise</span>
      </div>

      {error && (
        <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {/* Meta */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Details</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Filter Even Numbers"
              className={inputClass} style={inputStyle} />
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description (supports markdown)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Explain what the student needs to do…"
              className={`${inputClass} resize-none`} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Concept</label>
              <select value={concept} onChange={e => setConcept(e.target.value)}
                className={inputClass} style={inputStyle}>
                {concepts.length === 0 && <option value="">No concepts — add them first</option>}
                {concepts.map(c => <option key={c.id} value={c.slug}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value as ExerciseDifficulty)}
                className={inputClass} style={inputStyle}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as ExerciseType)}
                className={inputClass} style={inputStyle}>
                <option value="exercise">Exercise</option>
                <option value="challenge">Challenge</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Order #</label>
              <input type="number" min={1} value={order} onChange={e => setOrder(Number(e.target.value))}
                className={inputClass} style={inputStyle} />
            </div>
          </div>
        </div>
      </div>

      {/* Starter Code */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Starter Code</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          The code the student sees when they open the exercise. Name the main function <code className="text-[#0cc0df]">solution</code>.
        </p>
        <textarea value={starterCode} onChange={e => setStarterCode(e.target.value)}
          rows={8} className={textareaClass} style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px", lineHeight: "1.6" }} />
      </div>

      {/* Tests */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Test Cases</p>
          <button onClick={addTest} className="text-xs font-semibold transition hover:opacity-80"
            style={{ color: "#0cc0df" }}>+ Add Test</button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Each test runs in a sandboxed iframe. Use <code className="text-[#0cc0df]">assert(condition, message)</code> to check results.
        </p>
        <div className="space-y-4">
          {tests.map((test, i) => (
            <div key={test.id} className="rounded-2xl p-3 space-y-2" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>TEST {i + 1}</span>
                {tests.length > 1 && (
                  <button onClick={() => removeTest(i)} className="text-[10px] transition hover:opacity-70" style={{ color: "#ef4444" }}>Remove</button>
                )}
              </div>
              <input value={test.description} onChange={e => updateTest(i, "description", e.target.value)}
                placeholder='Description — e.g. "solution(2, 3) returns 5"'
                className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <textarea value={test.code} onChange={e => updateTest(i, "code", e.target.value)}
                rows={2} placeholder={`assert(solution(2, 3) === 5, "should return 5")`}
                className={textareaClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "11px" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Hints */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Hints</p>
          <button onClick={addHint} className="text-xs font-semibold transition hover:opacity-80" style={{ color: "#0cc0df" }}>+ Add Hint</button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Students can reveal hints one at a time when stuck.</p>
        <div className="space-y-2">
          {hints.map((hint, i) => (
            <div key={i} className="flex gap-2">
              <input value={hint} onChange={e => updateHint(i, e.target.value)}
                placeholder={`Hint ${i + 1}…`}
                className={`${inputClass} flex-1`} style={inputStyle} />
              {hints.length > 1 && (
                <button onClick={() => removeHint(i)} className="text-xs transition hover:opacity-70 shrink-0" style={{ color: "#ef4444" }}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Solution */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Solution (hidden from students)</p>
        <textarea value={solution} onChange={e => setSolution(e.target.value)}
          rows={8} placeholder="Write the correct solution here…"
          className={textareaClass} style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px", lineHeight: "1.6" }} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-8">
        <button onClick={handleSave} disabled={saving}
          className="rounded-full px-6 py-2.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#0cc0df", color: "#0a0b13" }}>
          {saving ? "Saving…" : "Save Exercise"}
        </button>
        <Link href="/exercises"
          className="rounded-full px-6 py-2.5 text-sm font-semibold transition hover:opacity-80"
          style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
