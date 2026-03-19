"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Course, CourseSettings } from "@/types/course";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";
import type { Lesson } from "@/types/lesson";

type Tab = "lessons" | "settings";

const SECTION_LABEL_KEYS = [
  { key: "warmUp",                label: "Opening Activity" },
  { key: "guidedLab",             label: "Guided Activity" },
  { key: "selfPaced",             label: "Independent Activity" },
  { key: "submissionChecklist",   label: "Requirements Checklist" },
  { key: "checkpoint",            label: "Common Problems / FAQ" },
  { key: "industryBestPractices", label: "Best Practices" },
  { key: "devJournalPrompt",      label: "Reflection Journal" },
  { key: "rubric",                label: "Assessment / Rubric" },
] as const;

const inputClass = "w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

const STATUS_COLOR: Record<Lesson["status"], string> = {
  draft:        "bg-[var(--text-muted)]",
  generating:   "bg-[#ff8c4a] animate-pulse",
  regenerating: "bg-[#0cc0df] animate-pulse",
  done:         "bg-[#2dd4a0]",
  error:        "bg-red-500",
};

const STATUS_LABEL: Record<Lesson["status"], string> = {
  draft: "Draft", generating: "Generating…", regenerating: "Regenerating…", done: "Done", error: "Error",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CourseDetailPage() {
  useSession({ required: true });
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("lessons");

  const [editSettings, setEditSettings] = useState<CourseSettings>(DEFAULT_COURSE_SETTINGS);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGradeLevel, setEditGradeLevel] = useState("");
  const [editTerm, setEditTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicating, setDuplicating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${id}`).then((r) => r.json()),
      fetch(`/api/lessons?courseId=${id}`).then((r) => r.json()),
    ]).then(([courseData, lessonData]) => {
      if (!courseData?.id) { setLoading(false); return; }
      setCourse(courseData);
      setEditTitle(courseData.title ?? "");
      setEditDescription(courseData.description ?? "");
      setEditGradeLevel(courseData.gradeLevel ?? "");
      setEditTerm(courseData.term ?? "");
      setEditSettings({ ...DEFAULT_COURSE_SETTINGS, ...(courseData.settings ?? {}) });
      setLessons(Array.isArray(lessonData) ? lessonData : []);
      setLoading(false);
    });
  }, [id]);

  function patchSettings(patch: Partial<CourseSettings>) {
    setEditSettings((prev) => ({ ...prev, ...patch }));
  }

  function patchSectionLabel(key: string, value: string) {
    setEditSettings((prev) => ({
      ...prev,
      sectionLabels: { ...prev.sectionLabels, [key]: value },
    }));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    const res = await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        gradeLevel: editGradeLevel,
        term: editTerm,
        settings: editSettings,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setCourse(updated);
      setSaveMsg("Settings saved.");
      setTimeout(() => setSaveMsg(""), 3000);
    }
  }

  async function handleToggleReleased(lesson: Lesson) {
    const updated = { ...lesson, released: !lesson.released };
    setLessons((prev) => prev.map((l) => l.id === lesson.id ? updated : l));
    await fetch(`/api/lessons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released: !lesson.released }),
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/courses/${id}/student`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleBulkRelease(release: boolean) {
    const targets = lessons.filter(l => l.released !== release);
    setLessons(prev => prev.map(l => ({ ...l, released: release })));
    await Promise.all(targets.map(l =>
      fetch(`/api/lessons/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ released: release }),
      })
    ));
  }

  function toggleSelect(lessonId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(lessonId) ? next.delete(lessonId) : next.add(lessonId);
      return next;
    });
  }

  async function duplicateLesson(lesson: Lesson): Promise<Lesson | null> {
    const full = await fetch(`/api/lessons/${lesson.id}`).then(r => r.json());
    const body = {
      title: `Copy of ${full.title}`,
      topics: full.topics ?? "",
      deadline: full.deadline ?? "",
      tag: full.tag ?? "",
      subtitle: full.subtitle ?? "",
      overview: full.overview ?? "",
      learningTargets: full.learningTargets ?? "",
      vocabulary: full.vocabulary ?? "",
      warmUp: full.warmUp ?? "",
      slideContent: full.slideContent ?? "",
      guidedLab: full.guidedLab ?? "",
      selfPaced: full.selfPaced ?? "",
      submissionChecklist: full.submissionChecklist ?? "",
      checkpoint: full.checkpoint ?? "",
      industryBestPractices: full.industryBestPractices ?? "",
      devJournalPrompt: full.devJournalPrompt ?? "",
      rubric: full.rubric ?? "",
      sources: full.sources ?? "",
      studentLevel: full.studentLevel,
      quizQuestions: full.quizQuestions,
      courseId: id,
      released: false,
      folder: full.folder ?? "",
    };
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const copy = await res.json();
    // Add to course lessonIds
    await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: [...(course?.lessonIds ?? []), copy.id] }),
    });
    return copy;
  }

  async function handleDuplicateLesson(lesson: Lesson) {
    const copy = await duplicateLesson(lesson);
    if (copy) {
      setLessons(prev => [...prev, copy]);
      setCourse(prev => prev ? { ...prev, lessonIds: [...prev.lessonIds, copy.id] } : prev);
    }
  }

  async function handleBulkDuplicate() {
    if (selectedIds.size === 0) return;
    setDuplicating(true);
    const targets = lessons.filter(l => selectedIds.has(l.id));
    const copies = await Promise.all(targets.map(duplicateLesson));
    const valid = copies.filter(Boolean) as Lesson[];
    if (valid.length) {
      setLessons(prev => [...prev, ...valid]);
      setCourse(prev => prev ? { ...prev, lessonIds: [...prev.lessonIds, ...valid.map(c => c.id)] } : prev);
    }
    setSelectedIds(new Set());
    setSelecting(false);
    setDuplicating(false);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} lesson${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    await Promise.all(ids.map(lid => fetch(`/api/lessons/${lid}`, { method: "DELETE" })));
    setLessons(prev => prev.filter(l => !selectedIds.has(l.id)));
    setCourse(prev => prev ? { ...prev, lessonIds: prev.lessonIds.filter(l => !selectedIds.has(l)) } : prev);
    setSelectedIds(new Set());
    setSelecting(false);
    setBulkDeleting(false);
  }

  async function handleRemoveLesson(lessonId: string) {
    if (!confirm("Remove this lesson from the course? The lesson itself won't be deleted.")) return;
    await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: course!.lessonIds.filter((l) => l !== lessonId) }),
    });
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
    setCourse((prev) => prev ? { ...prev, lessonIds: prev.lessonIds.filter((l) => l !== lessonId) } : prev);
  }

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading…</p>;
  if (!course) return <p className="text-sm text-red-500 mt-10">Course not found.</p>;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => router.push("/courses")} className="text-sm text-[#0cc0df] hover:underline">
        ← Back to Courses
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Course</p>
          <h1 className="text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{course.title}</h1>
          {course.description && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{course.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {course.settings?.subject && (
              <span className="rounded-xl px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.settings.subject}</span>
            )}
            {course.gradeLevel && (
              <span className="rounded-xl px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.gradeLevel}</span>
            )}
            {course.term && (
              <span className="rounded-xl px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.term}</span>
            )}
            {course.settings?.studentLevel && (
              <span className="rounded-xl px-2.5 py-0.5 text-xs font-semibold text-[#0cc0df] capitalize" style={{ background: "var(--accent-bg)" }}>{course.settings.studentLevel}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1.5">
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{lessons.length}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lessons.length === 1 ? "lesson" : "lessons"}</p>
          {lessons.length > 0 && (
            <div className="w-24">
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full bg-[#2dd4a0] transition-all duration-500"
                  style={{ width: `${Math.round((lessons.filter(l => l.released).length / lessons.length) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] mt-0.5 text-right" style={{ color: "var(--text-muted)" }}>
                {lessons.filter(l => l.released).length}/{lessons.length} released
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {(["lessons", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
              tab === t
                ? "bg-[#0cc0df] text-[#0a0b13]"
                : "hover:bg-[var(--bg-card-hover)]"
            }`}
            style={tab !== t ? { color: "var(--text-secondary)" } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Lessons Tab ──────────────────────────────────────────────── */}
      {tab === "lessons" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} in this course
              {lessons.filter(l => l.released).length > 0 && (
                <span className="ml-2 text-[#2dd4a0]">· {lessons.filter(l => l.released).length} released</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {selecting ? (
                <>
                  <button
                    onClick={() => { setSelecting(false); setSelectedIds(new Set()); }}
                    className="rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDuplicate}
                    disabled={selectedIds.size === 0 || duplicating || bulkDeleting}
                    className="rounded-xl bg-[#6366f1] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {duplicating ? "Duplicating…" : `Duplicate${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0 || duplicating || bulkDeleting}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    {bulkDeleting ? "Deleting…" : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                  </button>
                </>
              ) : (
                <>
                  {lessons.length > 0 && (
                    <>
                      <button
                        onClick={() => setSelecting(true)}
                        className="rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        Select
                      </button>
                      <button
                        onClick={() => handleBulkRelease(!lessons.every(l => l.released))}
                        className="rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        {lessons.every(l => l.released) ? "Unrelease All" : "Release All"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleCopyLink}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-[#2dd4a0] hover:bg-[#2dd4a0]/10 transition"
                    style={{ border: "1px solid #2dd4a0" }}
                  >
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                  <a
                    href={`/courses/${id}/student`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-[#2dd4a0] hover:bg-[#2dd4a0]/10 transition"
                    style={{ border: "1px solid #2dd4a0" }}
                  >
                    Student View ↗
                  </a>
                  <Link
                    href={`/lessons/new?courseId=${id}`}
                    className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition shadow"
                  >
                    + New Lesson
                  </Link>
                </>
              )}
            </div>
          </div>

          {lessons.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No lessons yet.</p>
              <Link
                href={`/lessons/new?courseId=${id}`}
                className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Add first lesson
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {lessons.map((lesson, i) => (
                <div
                  key={lesson.id}
                  onClick={selecting ? () => toggleSelect(lesson.id) : undefined}
                  className={`flex items-center gap-4 px-4 py-3 transition ${selecting ? "cursor-pointer" : "hover:bg-[var(--bg-card-hover)]"} ${selecting && selectedIds.has(lesson.id) ? "bg-[#6366f1]/10" : ""}`}
                  style={{
                    background: selecting && selectedIds.has(lesson.id) ? undefined : "var(--bg-card)",
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  {selecting ? (
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${selectedIds.has(lesson.id) ? "bg-[#6366f1] border-[#6366f1]" : "border-[var(--border)]"}`}
                      style={selectedIds.has(lesson.id) ? {} : { background: "var(--bg-body)" }}
                    >
                      {selectedIds.has(lesson.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  ) : (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[lesson.status]}`} />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{STATUS_LABEL[lesson.status]}</span>
                      {lesson.deadline && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Due {lesson.deadline}</span>
                      )}
                      {lesson.tag && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#0cc0df]" style={{ background: "var(--accent-bg)" }}>
                          {lesson.tag}
                        </span>
                      )}
                    </div>
                  </div>

                  {!selecting && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleReleased(lesson)}
                        title={lesson.released ? "Click to hide from students" : "Click to release to students"}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          lesson.released
                            ? "bg-[#2dd4a0]/15 text-[#2dd4a0] hover:bg-[#2dd4a0]/25"
                            : "hover:bg-[var(--bg-card-hover)]"
                        }`}
                        style={lesson.released ? {} : { border: "1px solid var(--border)", color: "var(--text-muted)" }}
                      >
                        {lesson.released ? "Released" : "Release"}
                      </button>
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="rounded-xl bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDuplicateLesson(lesson)}
                        title="Duplicate lesson"
                        className="p-1.5 rounded-lg transition hover:bg-[var(--bg-card-hover)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button
                        onClick={() => handleRemoveLesson(lesson.id)}
                        title="Delete lesson"
                        className="p-1.5 rounded-lg transition hover:text-red-500 hover:bg-red-500/10"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ─────────────────────────────────────────────── */}
      {tab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">

          {/* Course Info */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0cc0df] mb-3">Course Info</p>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Title</label>
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Description</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className={inputClass} style={inputStyle} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Grade Level</label>
                <input type="text" value={editGradeLevel} onChange={(e) => setEditGradeLevel(e.target.value)} placeholder="e.g. 9th Grade, College" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Term</label>
                <input type="text" value={editTerm} onChange={(e) => setEditTerm(e.target.value)} placeholder="e.g. Spring 2026" className={inputClass} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Generation Settings */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0cc0df] mb-1">Generation Settings</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>These override your global profile settings for every lesson in this course.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Industry</label>
                <input type="text" value={editSettings.industry} onChange={(e) => patchSettings({ industry: e.target.value })} placeholder="e.g. Coding, Healthcare" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subject Area</label>
                <input type="text" value={editSettings.subject} onChange={(e) => patchSettings({ subject: e.target.value })} placeholder="e.g. JavaScript, Nursing 101" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Student Level</label>
              <select value={editSettings.studentLevel} onChange={(e) => patchSettings({ studentLevel: e.target.value as CourseSettings["studentLevel"] })} className={inputClass} style={inputStyle}>
                <option value="">— Not specified —</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Default Sources</label>
              <textarea value={editSettings.defaultSources} onChange={(e) => patchSettings({ defaultSources: e.target.value })} rows={4} placeholder={"https://www.w3schools.com/\nhttps://developer.mozilla.org/"} className={`${inputClass} font-mono`} style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Slides Template URL <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <input type="url" value={editSettings.defaultTemplateUrl} onChange={(e) => patchSettings({ defaultTemplateUrl: e.target.value })} placeholder="https://docs.google.com/presentation/d/…" className={inputClass} style={inputStyle} />
            </div>
          </div>

          {/* Section Labels */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0cc0df]">Section Labels</p>
              <button type="button" onClick={() => patchSettings({ sectionLabels: DEFAULT_COURSE_SETTINGS.sectionLabels })} className="text-xs text-[#0cc0df] hover:underline">
                Reset to defaults
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SECTION_LABEL_KEYS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                  <input
                    type="text"
                    value={editSettings.sectionLabels[key]}
                    onChange={(e) => patchSectionLabel(key, e.target.value)}
                    placeholder={DEFAULT_COURSE_SETTINGS.sectionLabels[key]}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
            {saveMsg && <p className="text-sm text-[#2dd4a0]">{saveMsg}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
