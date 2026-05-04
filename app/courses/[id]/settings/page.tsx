"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { CourseSettings } from "@/types/course";
import type { Concept } from "@/types/concept";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TERM_YEARS: number[] = Array.from({ length: 21 }, (_, i) => 2040 - i); // 2040 down to 2020

const SECTION_LABEL_KEYS = [
  { key: "lessonOverview",        label: "Lesson Overview" },
  { key: "learningTargets",       label: "Learning Targets" },
  { key: "vocabulary",            label: "Vocabulary" },
  { key: "warmUp",                label: "Opening Activity" },
  { key: "guidedLab",             label: "Guided Activity" },
  { key: "selfPaced",             label: "Independent Activity" },
  { key: "submissionChecklist",   label: "Requirements Checklist" },
  { key: "checkpoint",            label: "Common Problems / FAQ" },
  { key: "industryBestPractices", label: "Best Practices" },
  { key: "devJournalPrompt",      label: "Reflection Journal" },
  { key: "rubric",                label: "Assessment / Rubric" },
] as const;

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const sectionHeading = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function CourseSettingsPage() {
  useSession({ required: true });
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();

  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(true);

  // Course info
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGradeLevel, setEditGradeLevel] = useState("");
  const [editTermMonth, setEditTermMonth] = useState("");
  const [editTermYear, setEditTermYear] = useState("");
  const [editSemester, setEditSemester] = useState("");
  const [editSettings, setEditSettings] = useState<CourseSettings>(DEFAULT_COURSE_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  // Google Classroom
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [classroomsLoading, setClassroomsLoading] = useState(false);
  const [classroomsError, setClassroomsError] = useState("");
  const [linkedClassroomId, setLinkedClassroomId] = useState("");
  const [linkedClassroomName, setLinkedClassroomName] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [savingClassroom, setSavingClassroom] = useState(false);
  const [classroomMsg, setClassroomMsg] = useState("");

  // Concepts
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [conceptError, setConceptError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function patchSettings(patch: Partial<CourseSettings>) {
    setEditSettings(prev => ({ ...prev, ...patch }));
  }

  function patchSectionLabel(key: string, value: string) {
    setEditSettings(prev => ({
      ...prev,
      sectionLabels: { ...prev.sectionLabels, [key]: value },
    }));
  }

  async function loadConcepts() {
    const res = await fetch(`/api/concepts?courseId=${courseId}`);
    const data = await res.json();
    setConcepts(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${courseId}`).then(r => r.json()),
      fetch(`/api/concepts?courseId=${courseId}`).then(r => r.json()),
    ]).then(([courseData, conceptData]) => {
      setCourseName(courseData.title ?? "");
      setEditTitle(courseData.title ?? "");
      setEditDescription(courseData.description ?? "");
      setEditGradeLevel(courseData.gradeLevel ?? "");
      const [termM = "", termY = ""] = (courseData.term ?? "").split(" ");
      setEditTermMonth(termM);
      setEditTermYear(termY);
      setEditSemester(courseData.semester ?? "");
      setEditSettings({ ...DEFAULT_COURSE_SETTINGS, ...(courseData.settings ?? {}) });
      setConcepts(Array.isArray(conceptData) ? conceptData : []);
      setLinkedClassroomId(courseData.googleClassroomId ?? "");
      setLinkedClassroomName(courseData.googleClassroomName ?? "");
      setSelectedClassroomId(courseData.googleClassroomId ?? "");
      setLoading(false);
    });
  }, [courseId]);

  async function loadClassrooms() {
    setClassroomsLoading(true);
    setClassroomsError("");
    try {
      const res = await fetch("/api/classroom");
      const data = await res.json();
      if (!res.ok) {
        setClassroomsError(data.error ?? "Failed to load classrooms.");
      } else {
        setClassrooms(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length === 0) {
          setClassroomsError("No classrooms found in your Google account.");
        }
      }
    } catch {
      setClassroomsError("Network error — could not reach the server.");
    }
    setClassroomsLoading(false);
  }

  async function handleLinkClassroom() {
    setSavingClassroom(true);
    setClassroomMsg("");
    const selected = classrooms.find(c => c.id === selectedClassroomId);
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        googleClassroomId: selectedClassroomId || null,
        googleClassroomName: selected?.name ?? null,
      }),
    });
    if (res.ok) {
      setLinkedClassroomId(selectedClassroomId);
      setLinkedClassroomName(selected?.name ?? "");
      setClassroomMsg(selectedClassroomId ? "Classroom linked." : "Classroom unlinked.");
      setTimeout(() => setClassroomMsg(""), 3000);
    }
    setSavingClassroom(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    setSaveError("");
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        gradeLevel: editGradeLevel,
        term: editTermMonth && editTermYear ? `${editTermMonth} ${editTermYear}` : "",
        semester: editSemester.trim() || undefined,
        settings: editSettings,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setCourseName(editTitle);
      setSaveMsg("Settings saved.");
      setTimeout(() => setSaveMsg(""), 3000);
    } else {
      setSaveError("Failed to save settings.");
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setConceptError("");
    const res = await fetch("/api/concepts/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    if (res.ok) {
      await loadConcepts();
    } else {
      const data = await res.json();
      setConceptError(data.error || "Seeding failed.");
    }
    setSeeding(false);
  }

  async function handleAddConcept() {
    if (!newLabel.trim() || !newSlug.trim()) { setConceptError("Label and slug are required."); return; }
    setAdding(true);
    setConceptError("");
    const maxOrder = concepts.length > 0 ? Math.max(...concepts.map(c => c.order)) : 0;
    const res = await fetch("/api/concepts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), slug: newSlug.trim(), description: newDesc.trim(), order: maxOrder + 1, courseId }),
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

  async function handleEditConcept(id: string) {
    setEditSaving(true);
    setConceptError("");
    const res = await fetch(`/api/concepts/${id}`, {
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
    setEditSaving(false);
  }

  async function handleDeleteConcept(id: string) {
    if (!confirm("Delete this concept? Exercises using this slug won't appear in this course anymore.")) return;
    const res = await fetch(`/api/concepts/${id}`, { method: "DELETE" });
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
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Link href="/courses" className="hover:underline" style={{ color: "#0cc0df" }}>Courses</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <Link href={`/courses/${courseId}`} className="hover:underline" style={{ color: "#0cc0df" }}>{courseName}</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Settings</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Course Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage course info, generation settings, section labels, and NeXTBox concepts.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Course Info */}
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className={sectionHeading}>Course Info</p>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Title</label>
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Description</label>
            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} className={inputClass} style={inputStyle} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Grade Level</label>
              <input type="text" value={editGradeLevel} onChange={e => setEditGradeLevel(e.target.value)} placeholder="e.g. 9th Grade, College" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Term <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select value={editTermMonth} onChange={e => setEditTermMonth(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={editTermYear} onChange={e => setEditTermYear(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Year</option>
                  {TERM_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Semester <span className="font-normal text-xs" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input type="text" value={editSemester} onChange={e => setEditSemester(e.target.value)} placeholder="e.g. Spring, Fall, Semester 1" className={inputClass} style={inputStyle} />
          </div>
        </div>

        {/* Generation Settings */}
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className={sectionHeading}>Generation Settings</p>
          <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>These override your global profile settings for every lesson in this course.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Industry</label>
              <input type="text" value={editSettings.industry} onChange={e => patchSettings({ industry: e.target.value })} placeholder="e.g. Coding, Healthcare" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subject Area</label>
              <input type="text" value={editSettings.subject} onChange={e => patchSettings({ subject: e.target.value })} placeholder="e.g. JavaScript, Nursing 101" className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Student Level</label>
            <select value={editSettings.studentLevel} onChange={e => patchSettings({ studentLevel: e.target.value as CourseSettings["studentLevel"] })} className={inputClass} style={inputStyle}>
              <option value="">— Not specified —</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Default Sources</label>
            <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Pre-filled in every new lesson in this course. One URL per line.</p>
            <textarea value={editSettings.defaultSources} onChange={e => patchSettings({ defaultSources: e.target.value })}
              rows={4} placeholder={"https://www.w3schools.com/\nhttps://developer.mozilla.org/"}
              className={`${inputClass} font-mono`} style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Slides Template URL <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input type="url" value={editSettings.defaultTemplateUrl} onChange={e => patchSettings({ defaultTemplateUrl: e.target.value })} placeholder="https://docs.google.com/presentation/d/…" className={inputClass} style={inputStyle} />
          </div>
        </div>

        {/* Section Labels */}
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className={sectionHeading}>Section Labels</p>
            <button type="button" onClick={() => patchSettings({ sectionLabels: DEFAULT_COURSE_SETTINGS.sectionLabels })}
              className="text-xs text-[#0cc0df] hover:underline">
              Reset to defaults
            </button>
          </div>
          <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>
            Customize the heading names used in generated docs for this course.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SECTION_LABEL_KEYS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                <input type="text" value={editSettings.sectionLabels[key]}
                  onChange={e => patchSectionLabel(key, e.target.value)}
                  placeholder={DEFAULT_COURSE_SETTINGS.sectionLabels[key]}
                  className={inputClass} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>

        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition shadow">
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saveMsg && <p className="text-sm font-medium" style={{ color: "#2dd4a0" }}>{saveMsg}</p>}
        </div>
      </form>

      {/* Google Classroom */}
      <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div>
          <p className={sectionHeading}>Google Classroom</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Link a Google Classroom to enable releasing lessons as draft assignments.
          </p>
        </div>

        {linkedClassroomId && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(12,192,223,0.06)", border: "1px solid rgba(12,192,223,0.2)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{linkedClassroomName}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Currently linked</p>
            </div>
            <button
              onClick={async () => {
                setSavingClassroom(true);
                const res = await fetch(`/api/courses/${courseId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ googleClassroomId: null, googleClassroomName: null }),
                });
                if (res.ok) {
                  setLinkedClassroomId(""); setLinkedClassroomName(""); setSelectedClassroomId("");
                  setClassroomMsg("Classroom unlinked.");
                  setTimeout(() => setClassroomMsg(""), 3000);
                }
                setSavingClassroom(false);
              }}
              className="text-xs hover:underline shrink-0" style={{ color: "#ef4444" }}>
              Unlink
            </button>
          </div>
        )}

        {classrooms.length === 0 ? (
          <div className="space-y-2">
            <button
              onClick={loadClassrooms}
              disabled={classroomsLoading}
              className="rounded-full px-4 py-2 text-xs font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "rgba(12,192,223,0.1)", color: "#0cc0df", border: "1px solid rgba(12,192,223,0.3)" }}>
              {classroomsLoading ? "Loading classrooms…" : "Load my Google Classrooms"}
            </button>
            {classroomsError && (
              <p className="text-xs" style={{ color: "#ef4444" }}>{classroomsError}</p>
            )}
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Select Classroom
              </label>
              <select
                value={selectedClassroomId}
                onChange={e => setSelectedClassroomId(e.target.value)}
                className={inputClass} style={inputStyle}>
                <option value="">— None —</option>
                {classrooms.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLinkClassroom}
              disabled={savingClassroom}
              className="rounded-full px-4 py-2 text-xs font-semibold transition hover:opacity-90 disabled:opacity-50 shrink-0"
              style={{ background: "#0cc0df", color: "#0a0b13" }}>
              {savingClassroom ? "Saving…" : selectedClassroomId ? "Link Classroom" : "Unlink"}
            </button>
          </div>
        )}
        {classroomMsg && <p className="text-xs font-medium" style={{ color: "#2dd4a0" }}>{classroomMsg}</p>}
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          After linking, use the <strong>Release</strong> button on each lesson or module to push it to this classroom as a draft assignment.
          If a matching title already exists, a copy is created automatically.
        </p>
      </div>

      {/* NeXTBox Concepts */}
      <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className={sectionHeading}>NeXTBox Concepts</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Topic categories students progress through in order.
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setConceptError(""); }}
            className="rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90"
            style={{ background: "#0cc0df", color: "#0a0b13" }}>
            + Add Concept
          </button>
        </div>

        {conceptError && (
          <div className="rounded-2xl px-4 py-3 text-xs font-medium" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            {conceptError}
          </div>
        )}

        {concepts.length === 0 && !showAddForm ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No concepts yet</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Create your own for any subject, or seed the JavaScript defaults to get started.
            </p>
            <button onClick={handleSeed} disabled={seeding}
              className="rounded-full px-5 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent-bg)", color: "#0cc0df", border: "1px solid rgba(12,192,223,0.3)" }}>
              {seeding ? "Seeding…" : "Seed JavaScript Defaults"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {concepts.map((concept, idx) => (
              <div key={concept.id}>
                {editId === concept.id ? (
                  <div className="rounded-3xl p-4 space-y-3" style={{ background: "var(--bg-card-hover)", border: "1px solid rgba(12,192,223,0.3)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>{concept.slug}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>slug is permanent</span>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Label</label>
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className={inputClass} style={inputStyle} />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} className={`${inputClass} resize-none`} style={inputStyle} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditConcept(concept.id)} disabled={editSaving}
                        className="rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
                        style={{ background: "#0cc0df", color: "#0a0b13" }}>
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="rounded-full px-4 py-1.5 text-xs font-semibold transition hover:opacity-80"
                        style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl px-4 py-3 flex items-start gap-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                    <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                      <button onClick={() => moveUp(idx)} disabled={idx === 0}
                        className="p-0.5 rounded transition hover:opacity-80 disabled:opacity-20" style={{ color: "var(--text-muted)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <span className="text-[10px] text-center leading-none" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                      <button onClick={() => moveDown(idx)} disabled={idx === concepts.length - 1}
                        className="p-0.5 rounded transition hover:opacity-80 disabled:opacity-20" style={{ color: "var(--text-muted)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{concept.label}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>{concept.slug}</span>
                      </div>
                      {concept.description && (
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{concept.description}</p>
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
          <div className="rounded-3xl p-4 space-y-4 mt-2" style={{ background: "var(--bg-card-hover)", border: "1px solid rgba(12,192,223,0.3)" }}>
            <p className={sectionHeading}>New Concept</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Label</label>
                <input value={newLabel}
                  onChange={e => { setNewLabel(e.target.value); if (!newSlug || newSlug === slugify(newLabel)) setNewSlug(slugify(e.target.value)); }}
                  placeholder="e.g. Control Flow" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Slug <span style={{ color: "var(--text-muted)" }}>(auto, permanent)</span></label>
                <input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g. control-flow" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                placeholder="What will students learn in this concept?" className={`${inputClass} resize-none`} style={inputStyle} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddConcept} disabled={adding}
                className="rounded-full px-5 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "#0cc0df", color: "#0a0b13" }}>
                {adding ? "Adding…" : "Add Concept"}
              </button>
              <button onClick={() => { setShowAddForm(false); setNewLabel(""); setNewSlug(""); setNewDesc(""); setConceptError(""); }}
                className="rounded-full px-5 py-2 text-xs font-semibold transition hover:opacity-80"
                style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {concepts.length > 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Slugs are permanent — they link to existing exercises. Edit labels and descriptions freely.
          </p>
        )}
      </div>
    </div>
  );
}
