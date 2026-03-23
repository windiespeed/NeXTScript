"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";
import type { CourseSettings } from "@/types/course";

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
const sectionHeading = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df] mb-3";

export default function NewCoursePage() {
  useSession({ required: true });
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [term, setTerm] = useState("");
  const [settings, setSettings] = useState<CourseSettings>(DEFAULT_COURSE_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function patchSettings(patch: Partial<CourseSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function patchSectionLabel(key: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      sectionLabels: { ...prev.sectionLabels, [key]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description, gradeLevel, term, settings, lessonIds: [] }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to create course.");
      setSaving(false);
      return;
    }
    const course = await res.json();
    // Attempt to create Drive folder — non-blocking, failure won't prevent navigation
    await fetch(`/api/courses/${course.id}/folder`, { method: "POST" }).catch(() => {});
    router.push(`/courses/${course.id}`);
  }

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="mb-6">
        <button onClick={() => router.push("/courses")} className="text-sm text-[#0cc0df] hover:underline mb-3 block">
          ← Back to Courses
        </button>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>New Course</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Set up a course with its own independent generation settings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Course Info ─────────────────────────────────────────────── */}
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className={sectionHeading}>Course Info</p>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JavaScript Fundamentals"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief summary of what this course covers…"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Grade Level</label>
              <input
                type="text"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="e.g. 9th Grade, College, Adult Ed"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Term</label>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. Spring 2026, Q1"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ── Generation Settings ─────────────────────────────────────── */}
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className={sectionHeading}>Generation Settings</p>
          <p className="text-xs -mt-1 mb-2" style={{ color: "var(--text-muted)" }}>
            These override your global profile settings for every lesson in this course.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Industry</label>
              <input
                type="text"
                value={settings.industry}
                onChange={(e) => patchSettings({ industry: e.target.value })}
                placeholder="e.g. Coding, Healthcare, Business"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subject Area</label>
              <input
                type="text"
                value={settings.subject}
                onChange={(e) => patchSettings({ subject: e.target.value })}
                placeholder="e.g. JavaScript, Nursing 101"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Student Level</label>
            <select
              value={settings.studentLevel}
              onChange={(e) => patchSettings({ studentLevel: e.target.value as CourseSettings["studentLevel"] })}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">— Not specified —</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Default Sources</label>
            <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Pre-filled in every new lesson in this course. One URL per line.</p>
            <textarea
              value={settings.defaultSources}
              onChange={(e) => patchSettings({ defaultSources: e.target.value })}
              rows={4}
              placeholder={"https://www.w3schools.com/\nhttps://developer.mozilla.org/"}
              className={`${inputClass} font-mono`}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Slides Template URL <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input
              type="url"
              value={settings.defaultTemplateUrl}
              onChange={(e) => patchSettings({ defaultTemplateUrl: e.target.value })}
              placeholder="https://docs.google.com/presentation/d/…"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Section Labels ──────────────────────────────────────────── */}
        <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className={sectionHeading}>Section Labels</p>
            <button
              type="button"
              onClick={() => patchSettings({ sectionLabels: DEFAULT_COURSE_SETTINGS.sectionLabels })}
              className="text-xs text-[#0cc0df] hover:underline"
            >
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
                <input
                  type="text"
                  value={settings.sectionLabels[key]}
                  onChange={(e) => patchSectionLabel(key, e.target.value)}
                  placeholder={DEFAULT_COURSE_SETTINGS.sectionLabels[key]}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/courses")}
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-card-hover)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
          >
            {saving ? "Creating…" : "Create Course"}
          </button>
        </div>
      </form>
    </div>
  );
}
