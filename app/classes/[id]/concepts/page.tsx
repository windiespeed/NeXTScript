"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Concept } from "@/types/concept";

const cardClass = "rounded-3xl p-5";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function ClassConceptsPage() {
  useSession({ required: true });
  const { id: classId } = useParams<{ id: string }>();

  const [className, setClassName] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [classRes, conceptsRes] = await Promise.all([
      fetch(`/api/classes/${classId}`),
      fetch(`/api/concepts?classId=${classId}`),
    ]);
    const classData = await classRes.json();
    const conceptData = await conceptsRes.json();
    setClassName(classData.name ?? "");
    setConcepts(Array.isArray(conceptData) ? conceptData : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [classId]);

  async function handleSeed() {
    setSeeding(true);
    setError("");
    const res = await fetch("/api/concepts/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    });
    if (res.ok) {
      await load();
    } else {
      const data = await res.json();
      setError(data.error || "Seeding failed.");
    }
    setSeeding(false);
  }

  async function handleAdd() {
    if (!newLabel.trim() || !newSlug.trim()) { setError("Label and slug are required."); return; }
    setAdding(true);
    setError("");
    const maxOrder = concepts.length > 0 ? Math.max(...concepts.map(c => c.order)) : 0;
    const res = await fetch("/api/concepts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), slug: newSlug.trim(), description: newDesc.trim(), order: maxOrder + 1, classId }),
    });
    if (res.ok) {
      setNewLabel(""); setNewSlug(""); setNewDesc(""); setShowAddForm(false);
      await load();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to add.");
    }
    setAdding(false);
  }

  async function handleEdit(id: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/concepts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim(), description: editDesc.trim() }),
    });
    if (res.ok) {
      setEditId(null);
      await load();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this concept? Exercises using this slug won't appear in this class anymore.")) return;
    const res = await fetch(`/api/concepts/${id}`, { method: "DELETE" });
    if (res.ok) { await load(); } else {
      const data = await res.json();
      setError(data.error || "Failed to delete.");
    }
  }

  async function moveUp(idx: number) {
    if (idx === 0) return;
    const a = concepts[idx], b = concepts[idx - 1];
    await Promise.all([
      fetch(`/api/concepts/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: b.order }) }),
      fetch(`/api/concepts/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) }),
    ]);
    await load();
  }

  async function moveDown(idx: number) {
    if (idx === concepts.length - 1) return;
    const a = concepts[idx], b = concepts[idx + 1];
    await Promise.all([
      fetch(`/api/concepts/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: b.order }) }),
      fetch(`/api/concepts/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) }),
    ]);
    await load();
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: "#0cc0df" }}>Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/classes" className="text-sm hover:underline" style={{ color: "#0cc0df" }}>← Classes</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <Link href={`/classes/${classId}`} className="text-sm hover:underline" style={{ color: "#0cc0df" }}>{className}</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Concepts</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Concepts</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Topic categories for <span style={{ color: "var(--text-secondary)" }}>{className}</span>. Students progress through these in order.
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setError(""); }}
          className="rounded-full px-4 py-2 text-xs font-bold transition hover:opacity-90"
          style={{ background: "#0cc0df", color: "#0a0b13" }}
        >
          + Add Concept
        </button>
      </div>

      {error && (
        <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {concepts.length === 0 ? (
        <div className={cardClass} style={cardStyle}>
          <div className="text-center py-8 space-y-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No concepts yet</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Create your own concepts for any subject, or seed the JavaScript defaults to get started.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="rounded-full px-5 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent-bg)", color: "#0cc0df", border: "1px solid rgba(12,192,223,0.3)" }}
            >
              {seeding ? "Seeding…" : "Seed JavaScript Defaults"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {concepts.map((concept, idx) => (
            <div key={concept.id}>
              {editId === concept.id ? (
                <div className="rounded-3xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid rgba(12,192,223,0.3)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>{concept.slug}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>slug is permanent</span>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Label</label>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                      rows={2} className={`${inputClass} resize-none`} style={inputStyle} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(concept.id)} disabled={saving}
                      className="rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
                      style={{ background: "#0cc0df", color: "#0a0b13" }}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="rounded-full px-4 py-1.5 text-xs font-semibold transition hover:opacity-80"
                      style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl px-4 py-3 flex items-start gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                    <button onClick={() => moveUp(idx)} disabled={idx === 0}
                      className="p-0.5 rounded transition hover:opacity-80 disabled:opacity-20"
                      style={{ color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <span className="text-[10px] text-center leading-none" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                    <button onClick={() => moveDown(idx)} disabled={idx === concepts.length - 1}
                      className="p-0.5 rounded transition hover:opacity-80 disabled:opacity-20"
                      style={{ color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{concept.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>{concept.slug}</span>
                    </div>
                    {concept.description && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{concept.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setEditId(concept.id); setEditLabel(concept.label); setEditDesc(concept.description); setError(""); }}
                      className="text-xs transition hover:opacity-80" style={{ color: "#0cc0df" }}>Edit</button>
                    <button onClick={() => handleDelete(concept.id)}
                      className="text-xs transition hover:opacity-80" style={{ color: "#ef4444" }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className={`${cardClass} space-y-4`} style={{ ...cardStyle, border: "1px solid rgba(12,192,223,0.3)" }}>
          <p className={sectionLabel}>New Concept</p>
          <div className="grid grid-cols-2 gap-3">
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
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
              rows={2} placeholder="What will students learn in this concept?"
              className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding}
              className="rounded-full px-5 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "#0cc0df", color: "#0a0b13" }}>
              {adding ? "Adding…" : "Add Concept"}
            </button>
            <button onClick={() => { setShowAddForm(false); setNewLabel(""); setNewSlug(""); setNewDesc(""); setError(""); }}
              className="rounded-full px-5 py-2 text-xs font-semibold transition hover:opacity-80"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {concepts.length > 0 && (
        <p className="text-xs pb-8" style={{ color: "var(--text-muted)" }}>
          Slugs are permanent — they link to existing exercises. Edit labels and descriptions freely.
        </p>
      )}
    </div>
  );
}
