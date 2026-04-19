"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { ProgressMode } from "@/types/class";
import type { Course } from "@/types/course";
import type { Concept } from "@/types/concept";
import DriveCourseEditor from "@/components/DriveCourseEditor";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs font-semibold px-2 py-0.5 rounded-full transition hover:opacity-80"
      style={{ background: copied ? "rgba(45,212,160,0.12)" : "var(--bg-card-hover)", color: copied ? "#2dd4a0" : "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function ModulePage() {
  useSession({ required: true });
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  // Module (NeXTBox) state
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [language, setLanguage] = useState<"javascript" | "python" | "html-css">("javascript");
  const [progressMode, setProgressMode] = useState<ProgressMode>("locked");
  const [solutionRevealAttempts, setSolutionRevealAttempts] = useState<number | null>(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Drive content state
  const [linkedContent, setLinkedContent] = useState<Course[]>([]);
  const [unassigned, setUnassigned] = useState<Course[]>([]);
  const [assignPanelOpen, setAssignPanelOpen] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);

  // Concepts state
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [conceptError, setConceptError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [cSaving, setCsaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/modules/${id}`).then(r => r.json()),
      fetch(`/api/courses?moduleId=${id}`).then(r => r.json()),
    ]).then(([moduleData, driveData]) => {
      if (moduleData.error) { setError(moduleData.error); setLoading(false); return; }
      setName(moduleData.name);
      setJoinCode(moduleData.joinCode ?? "");
      setStudentCount(moduleData.studentIds?.length ?? 0);
      setLanguage(moduleData.language);
      setProgressMode(moduleData.progressMode ?? "locked");
      setSolutionRevealAttempts(moduleData.solutionRevealAttempts ?? null);
      setLoading(false);
      setLinkedContent(Array.isArray(driveData) ? driveData : []);
      setLoadingContent(false);
    });
    loadConcepts();
  }, [id]);

  async function loadConcepts() {
    setConceptsLoading(true);
    const res = await fetch(`/api/concepts?classId=${id}`);
    const data = await res.json();
    setConcepts(Array.isArray(data) ? data : []);
    setConceptsLoading(false);
  }

  async function openAssignPanel() {
    setAssignPanelOpen(true);
    if (unassigned.length === 0) {
      setLoadingUnassigned(true);
      const data = await fetch("/api/courses?unassigned=true").then(r => r.json());
      setUnassigned(Array.isArray(data) ? data : []);
      setLoadingUnassigned(false);
    }
  }

  async function handleAssign(driveId: string) {
    await fetch(`/api/courses/${driveId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId: id }),
    });
    const assigned = unassigned.find(c => c.id === driveId);
    if (assigned) {
      setLinkedContent(prev => [...prev, { ...assigned, moduleId: id }]);
      setUnassigned(prev => prev.filter(c => c.id !== driveId));
    }
  }

  async function handleUnlink(driveId: string) {
    await fetch(`/api/courses/${driveId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId: null }),
    });
    const removed = linkedContent.find(c => c.id === driveId);
    setLinkedContent(prev => prev.filter(c => c.id !== driveId));
    if (removed) setUnassigned(prev => [...prev, { ...removed, moduleId: undefined }]);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Module name is required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/modules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), language, progressMode, solutionRevealAttempts }),
    });
    if (res.ok) {
      router.push("/modules");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save.");
      setSaving(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setConceptError("");
    const res = await fetch("/api/concepts/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: id }),
    });
    if (res.ok) {
      await loadConcepts();
    } else {
      const data = await res.json();
      setConceptError(data.error || "Seeding failed.");
    }
    setSeeding(false);
  }

  async function handleAdd() {
    if (!newLabel.trim() || !newSlug.trim()) { setConceptError("Label and slug are required."); return; }
    setAdding(true);
    setConceptError("");
    const maxOrder = concepts.length > 0 ? Math.max(...concepts.map(c => c.order)) : 0;
    const res = await fetch("/api/concepts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), slug: newSlug.trim(), description: newDesc.trim(), order: maxOrder + 1, classId: id }),
    });
    if (res.ok) {
      setNewLabel(""); setNewSlug(""); setNewDesc(""); setShowAddForm(false);
      await loadConcepts();
    } else {
      const data = await res.json();
      setConceptError(data.error || "Failed to add.");
    }
    setAdding(false);
  }

  async function handleEditConcept(conceptId: string) {
    setCsaving(true);
    setConceptError("");
    const res = await fetch(`/api/concepts/${conceptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim(), description: editDesc.trim() }),
    });
    if (res.ok) {
      setEditId(null);
      await loadConcepts();
    } else {
      const data = await res.json();
      setConceptError(data.error || "Failed to save.");
    }
    setCsaving(false);
  }

  async function handleDeleteConcept(conceptId: string) {
    if (!confirm("Delete this concept? Exercises using this slug won't appear in this module anymore.")) return;
    const res = await fetch(`/api/concepts/${conceptId}`, { method: "DELETE" });
    if (res.ok) { await loadConcepts(); } else {
      const data = await res.json();
      setConceptError(data.error || "Failed to delete.");
    }
  }

  async function moveUp(idx: number) {
    if (idx === 0) return;
    const a = concepts[idx], b = concepts[idx - 1];
    await Promise.all([
      fetch(`/api/concepts/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: b.order }) }),
      fetch(`/api/concepts/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) }),
    ]);
    await loadConcepts();
  }

  async function moveDown(idx: number) {
    if (idx === concepts.length - 1) return;
    const a = concepts[idx], b = concepts[idx + 1];
    await Promise.all([
      fetch(`/api/concepts/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: b.order }) }),
      fetch(`/api/concepts/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) }),
    ]);
    await loadConcepts();
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: "#0cc0df" }}>Loading…</div>;

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/modules" className="text-sm hover:underline" style={{ color: "#0cc0df" }}>← Modules</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{name}</span>
      </div>

      {error && (
        <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {/* NeXTBox Settings */}
      <div className={cardClass} style={cardStyle}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>NeXTBox Module</p>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{name}</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {studentCount} student{studentCount !== 1 ? "s" : ""} · {language}
            </p>
          </div>
          <Link href={`/modules/${id}/progress`}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
            style={{ background: "rgba(45,212,160,0.08)", color: "#2dd4a0", border: "1px solid rgba(45,212,160,0.2)" }}>
            Progress
          </Link>
        </div>

        {joinCode && (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>Student Join Code</p>
              <p className="text-xl font-bold tracking-[0.2em]" style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{joinCode}</p>
            </div>
            <CopyButton text={joinCode} />
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", marginTop: "4px", paddingTop: "16px" }} className="space-y-4">
          {/* Module Details */}
          <div className="space-y-3">
            <p className={sectionLabel}>Module Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Module Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Period 3 — Intro to JavaScript"
                  className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value as "javascript" | "python" | "html-css")} className={inputClass} style={inputStyle}>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python (coming soon)</option>
                  <option value="html-css">HTML & CSS (coming soon)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Exercise Visibility */}
          <div className="space-y-2">
            <p className={sectionLabel}>Exercise Visibility</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "sequential", label: "One at a Time", desc: "Only the current exercise is visible. Next unlocks after passing." },
                { value: "locked",     label: "Locked",        desc: "All exercises visible but locked. Unlocks after each is passed." },
                { value: "free",       label: "Free Roam",     desc: "All exercises visible and accessible in any order." },
              ] as { value: ProgressMode; label: string; desc: string }[]).map(opt => (
                <button key={opt.value} onClick={() => setProgressMode(opt.value)}
                  className="rounded-2xl p-3 text-left transition"
                  style={progressMode === opt.value
                    ? { background: "rgba(12,192,223,0.12)", border: "1px solid rgba(12,192,223,0.4)" }
                    : { background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: progressMode === opt.value ? "#0cc0df" : "var(--text-primary)" }}>{opt.label}</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Solution Reveal */}
          <div className="space-y-2">
            <p className={sectionLabel}>Solution Reveal</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={solutionRevealAttempts !== null}
                  onChange={e => setSolutionRevealAttempts(e.target.checked ? 5 : null)} />
                Show solution after
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

          {/* Concepts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className={sectionLabel}>Concepts</p>
              {!showAddForm && (
                <button
                  onClick={() => { setShowAddForm(true); setConceptError(""); }}
                  className="rounded-full px-3 py-1.5 text-xs font-bold transition hover:opacity-90"
                  style={{ background: "#0cc0df", color: "#0a0b13" }}>
                  + Add
                </button>
              )}
            </div>

            {conceptError && (
              <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                {conceptError}
              </div>
            )}

            {conceptsLoading ? (
              <p className="text-sm text-[#0cc0df]">Loading…</p>
            ) : concepts.length === 0 && !showAddForm ? (
              <div className="rounded-2xl py-6 text-center" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>No concepts yet</p>
                <button onClick={handleSeed} disabled={seeding}
                  className="rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--accent-bg)", color: "#0cc0df", border: "1px solid rgba(12,192,223,0.3)" }}>
                  {seeding ? "Seeding…" : "Seed JavaScript Defaults"}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {concepts.map((concept, idx) => (
                  <div key={concept.id}>
                    {editId === concept.id ? (
                      <div className="rounded-2xl p-3 space-y-2" style={{ background: "var(--bg-card-hover)", border: "1px solid rgba(12,192,223,0.3)" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>{concept.slug}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>slug is permanent</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Label</label>
                            <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className={inputClass} style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
                            <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className={inputClass} style={inputStyle} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditConcept(concept.id)} disabled={cSaving}
                            className="rounded-full px-3 py-1 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
                            style={{ background: "#0cc0df", color: "#0a0b13" }}>
                            {cSaving ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80"
                            style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl px-3 py-2 flex items-center gap-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button onClick={() => moveUp(idx)} disabled={idx === 0}
                            className="p-0.5 rounded transition hover:opacity-80 disabled:opacity-20"
                            style={{ color: "var(--text-muted)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                          </button>
                          <span className="text-[10px] text-center leading-none" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                          <button onClick={() => moveDown(idx)} disabled={idx === concepts.length - 1}
                            className="p-0.5 rounded transition hover:opacity-80 disabled:opacity-20"
                            style={{ color: "var(--text-muted)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{concept.label}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>{concept.slug}</span>
                          {concept.description && (
                            <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{concept.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => { setEditId(concept.id); setEditLabel(concept.label); setEditDesc(concept.description); setConceptError(""); }}
                            className="text-xs transition hover:opacity-80" style={{ color: "#0cc0df" }}>Edit</button>
                          <button onClick={() => handleDeleteConcept(concept.id)}
                            className="text-xs transition hover:opacity-80" style={{ color: "#ef4444" }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showAddForm && (
              <div className="rounded-2xl p-3 space-y-2" style={{ background: "var(--bg-card-hover)", border: "1px solid rgba(12,192,223,0.3)" }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Label</label>
                    <input value={newLabel}
                      onChange={e => { setNewLabel(e.target.value); if (!newSlug || newSlug === slugify(newLabel)) setNewSlug(slugify(e.target.value)); }}
                      placeholder="e.g. Control Flow"
                      className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Slug <span style={{ color: "var(--text-muted)" }}>(auto, permanent)</span></label>
                    <input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="e.g. control-flow"
                      className={inputClass} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                    placeholder="What will students learn in this concept?"
                    className={inputClass} style={inputStyle} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAdd} disabled={adding}
                    className="rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#0cc0df", color: "#0a0b13" }}>
                    {adding ? "Adding…" : "Add Concept"}
                  </button>
                  <button onClick={() => { setShowAddForm(false); setNewLabel(""); setNewSlug(""); setNewDesc(""); setConceptError(""); }}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold transition hover:opacity-80"
                    style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {concepts.length > 0 && (
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Slugs are permanent — they link to existing exercises.
              </p>
            )}
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="rounded-full px-6 py-2.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "#0cc0df", color: "#0a0b13" }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <Link href="/modules"
              className="rounded-full px-6 py-2.5 text-sm font-semibold transition hover:opacity-80"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* ── Drive Content ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          <p className="text-xs font-bold uppercase tracking-widest px-2" style={{ color: "var(--text-muted)" }}>Drive Content</p>
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>

        <div className="space-y-6">
          {loadingContent ? (
            <p className="text-sm text-[#0cc0df]">Loading…</p>
          ) : linkedContent.length === 0 ? (
            <div className="rounded-3xl py-12 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No Drive content linked</p>
              <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
                Assign an existing course or create a new one for this module.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {linkedContent.map(driveCourse => (
                <div key={driveCourse.id} className="rounded-3xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <DriveCourseEditor driveId={driveCourse.id} onUnlink={() => handleUnlink(driveCourse.id)} />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={openAssignPanel}
              className="rounded-full px-4 py-2 text-xs font-semibold transition hover:opacity-80"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              + Assign Existing
            </button>
            <Link href="/courses/new"
              className="rounded-full px-4 py-2 text-xs font-semibold transition hover:opacity-90"
              style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent-purple)", border: "1px solid rgba(99,102,241,0.3)" }}>
              + New Drive Content
            </Link>
          </div>

          {/* Assign panel */}
          {assignPanelOpen && (
            <div className="rounded-3xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className={sectionLabel}>Unassigned Drive Content</p>
                <button onClick={() => setAssignPanelOpen(false)} className="text-xs transition hover:opacity-70" style={{ color: "var(--text-muted)" }}>✕ Close</button>
              </div>
              {loadingUnassigned ? (
                <p className="text-xs text-[#0cc0df]">Loading…</p>
              ) : unassigned.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  All Drive content is already assigned. <Link href="/courses/new" className="underline" style={{ color: "#0cc0df" }}>Create new →</Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {unassigned.map(course => (
                    <div key={course.id} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                      style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{course.title}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {course.lessonIds.length} {course.lessonIds.length === 1 ? "lesson" : "lessons"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAssign(course.id)}
                        className="rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-90 shrink-0"
                        style={{ background: "#0cc0df", color: "#0a0b13" }}>
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pb-8" />
    </div>
  );
}
