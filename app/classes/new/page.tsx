"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONCEPT_LABELS, CONCEPT_ORDER } from "@/types/exercise";
import type { ExerciseConcept } from "@/types/exercise";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

export default function NewClassPage() {
  useSession({ required: true });
  const router = useRouter();

  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"javascript" | "python" | "html-css">("javascript");
  const [selectedConcepts, setSelectedConcepts] = useState<ExerciseConcept[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleConcept(c: ExerciseConcept) {
    setSelectedConcepts(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  function selectAll() { setSelectedConcepts([...CONCEPT_ORDER]); }
  function clearAll() { setSelectedConcepts([]); }

  async function handleSave() {
    if (!name.trim()) { setError("Class name is required."); return; }
    if (selectedConcepts.length === 0) { setError("Select at least one concept."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), language, assignedConcepts: selectedConcepts }),
    });
    if (res.ok) {
      router.push("/classes");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/classes" className="text-sm hover:underline" style={{ color: "#0cc0df" }}>← Classes</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Class</span>
      </div>

      {error && (
        <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Class Details</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Class Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Period 3 — Intro to JavaScript"
              className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value as any)} className={inputClass} style={inputStyle}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python (coming soon)</option>
              <option value="html-css">HTML & CSS (coming soon)</option>
            </select>
          </div>
        </div>
      </div>

      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Concepts</p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs hover:underline" style={{ color: "#0cc0df" }}>Select all</button>
            <button onClick={clearAll} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>Clear</button>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Only the selected concepts will be visible to students in NeXTBox.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CONCEPT_ORDER.map(c => {
            const active = selectedConcepts.includes(c);
            return (
              <button key={c} onClick={() => toggleConcept(c)}
                className="rounded-2xl px-3 py-2.5 text-xs font-medium text-left transition"
                style={active
                  ? { background: "rgba(99,102,241,0.15)", color: "var(--accent-purple)", border: "1px solid rgba(99,102,241,0.4)" }
                  : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {active && <span className="mr-1">✓</span>}
                {CONCEPT_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pb-8">
        <button onClick={handleSave} disabled={saving}
          className="rounded-full px-6 py-2.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#0cc0df", color: "#0a0b13" }}>
          {saving ? "Creating…" : "Create Class"}
        </button>
        <Link href="/classes"
          className="rounded-full px-6 py-2.5 text-sm font-semibold transition hover:opacity-80"
          style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
