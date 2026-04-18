"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { Concept } from "@/types/concept";
import type { ProgressMode } from "@/types/class";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

export default function EditClassPage() {
  useSession({ required: true });
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"javascript" | "python" | "html-css">("javascript");
  const [progressMode, setProgressMode] = useState<ProgressMode>("locked");
  const [solutionRevealAttempts, setSolutionRevealAttempts] = useState<number | null>(5);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/classes/${id}`).then(r => r.json()),
      fetch("/api/concepts").then(r => r.json()),
    ]).then(([classData, conceptData]) => {
      if (classData.error) { setError(classData.error); setLoading(false); return; }
      setName(classData.name);
      setLanguage(classData.language);
      setProgressMode(classData.progressMode ?? "locked");
      setSolutionRevealAttempts(classData.solutionRevealAttempts ?? null);
      setSelectedConcepts(classData.assignedConcepts ?? []);
      setConcepts(Array.isArray(conceptData) ? conceptData : []);
      setLoading(false);
    });
  }, [id]);

  function toggleConcept(c: string) {
    setSelectedConcepts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Class name is required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/classes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), language, progressMode, solutionRevealAttempts, assignedConcepts: selectedConcepts }),
    });
    if (res.ok) {
      router.push("/classes");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save.");
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm" style={{ color: "#0cc0df" }}>Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/classes" className="text-sm hover:underline" style={{ color: "#0cc0df" }}>← Classes</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Edit Class</span>
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
          <div>
            <label className="text-xs mb-2 block" style={{ color: "var(--text-muted)" }}>Exercise Visibility</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "sequential", label: "One at a Time", desc: "Only the current exercise is visible. Next unlocks after passing." },
                { value: "locked",     label: "Locked",        desc: "All exercises visible but locked. Unlocks after each is passed." },
                { value: "free",       label: "Free Roam",     desc: "All exercises visible and accessible in any order." },
              ] as { value: ProgressMode; label: string; desc: string }[]).map(opt => (
                <button key={opt.value} onClick={() => setProgressMode(opt.value)}
                  className="rounded-2xl p-3 text-left transition"
                  style={progressMode === opt.value
                    ? { background: "rgba(12,192,223,0.12)", border: "1px solid rgba(12,192,223,0.4)", color: "var(--text-primary)" }
                    : { background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: progressMode === opt.value ? "#0cc0df" : "var(--text-primary)" }}>{opt.label}</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Solution Reveal</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Automatically show the solution to students after a set number of failed attempts.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={solutionRevealAttempts !== null}
              onChange={e => setSolutionRevealAttempts(e.target.checked ? 5 : null)} />
            Enable after
          </label>
          {solutionRevealAttempts !== null && (
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={50} value={solutionRevealAttempts}
                onChange={e => setSolutionRevealAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                className={`w-16 text-center ${inputClass}`} style={inputStyle} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>failed attempts</span>
            </div>
          )}
          {solutionRevealAttempts === null && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Never show solution</span>
          )}
        </div>
      </div>

      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Concepts</p>
          <div className="flex gap-2">
            <button onClick={() => setSelectedConcepts(concepts.map(c => c.slug))} className="text-xs hover:underline" style={{ color: "#0cc0df" }}>Select all</button>
            <button onClick={() => setSelectedConcepts([])} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>Clear</button>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Only the selected concepts will be visible to students in NeXTBox.
        </p>
        {concepts.length === 0 ? (
          <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>
            No concepts yet. <a href="/concepts" className="underline" style={{ color: "#0cc0df" }}>Add concepts first.</a>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {concepts.map(c => {
              const active = selectedConcepts.includes(c.slug);
              return (
                <button key={c.id} onClick={() => toggleConcept(c.slug)}
                  className="rounded-2xl px-3 py-2.5 text-xs font-medium text-left transition"
                  style={active
                    ? { background: "rgba(99,102,241,0.15)", color: "var(--accent-purple)", border: "1px solid rgba(99,102,241,0.4)" }
                    : { background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  {active && <span className="mr-1">✓</span>}
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3 pb-8">
        <button onClick={handleSave} disabled={saving}
          className="rounded-full px-6 py-2.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#0cc0df", color: "#0a0b13" }}>
          {saving ? "Saving…" : "Save Changes"}
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
