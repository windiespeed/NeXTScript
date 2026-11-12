"use client";

import { useEffect, useRef, useState } from "react";
import type { Lesson, LessonInput } from "@/types/lesson";
import { DEFAULT_SECTIONS, type SectionDef } from "@/types/section";
import { resolveSections, getSectionContent } from "@/lib/sections";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[var(--accent-text)]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

interface Props {
  initial?: Partial<Lesson>;
  onSubmit: (data: LessonInput) => Promise<void>;
  autoSave?: (data: LessonInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  hasAiKey?: boolean;
  isEditing?: boolean;
}

const EMPTY: LessonInput = {
  title: "",
  subtitle: "",
  topics: "",
  deadline: "",
  tag: "",
  notes: "",
  overview: "",
  learningTargets: "",
  vocabulary: "",
  warmUp: "",
  slideContent: "",
  guidedLab: "",
  selfPaced: "",
  submissionChecklist: "",
  checkpoint: "",
  industryBestPractices: "",
  devJournalPrompt: "",
  rubric: "",
  sources: "",
  studentLevel: "beginner",
  sections: {},
};

/** Defined outside LessonForm so React doesn't remount it on every keystroke. */
function SectionClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] font-semibold rounded-full px-2 py-0.5 transition hover:bg-red-500/10 hover:text-[var(--danger-text)]"
      style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      Clear
    </button>
  );
}

/**
 * Edits a lesson's info and section text (used for AI quiz drafts). Slides are built in Notes
 * to Slides; a lesson's old Classic Slide Content is kept as-is (it still seeds Notes to Slides
 * and quizzes) but is no longer edited here.
 */
export default function LessonForm({ initial = {}, onSubmit, autoSave, onCancel, submitLabel = "Save Lesson", hasAiKey = false, isEditing = false }: Props) {
  const [form, setForm] = useState<LessonInput>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [sections, setSections] = useState<SectionDef[]>(DEFAULT_SECTIONS);

  function clearSection(keys: (keyof LessonInput)[], extra?: () => void) {
    setForm(f => {
      const next = { ...f };
      for (const k of keys) (next as any)[k] = EMPTY[k];
      return next;
    });
    setAiFilledFields(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.delete(k as string));
      return next;
    });
    extra?.();
  }

  function setSection(id: string, value: string) {
    setForm(f => ({ ...f, sections: { ...f.sections, [id]: value } }));
  }

  function clearSections(ids: string[]) {
    setForm(f => {
      const nextSections = { ...f.sections };
      for (const id of ids) nextSections[id] = "";
      return { ...f, sections: nextSections };
    });
    setAiFilledFields(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }

  // Resolves the active section list (course-level > user-level > synthesized defaults) and,
  // for a lesson that predates the dynamic-sections model (no `initial.sections` at all),
  // seeds `form.sections` from its legacy fixed fields — the write that actually migrates it,
  // with zero Firestore backfill needed for lessons nobody opens.
  useEffect(() => {
    const courseId = initial.courseId;
    Promise.all([
      fetch("/api/user/settings").then(r => r.json()).catch(() => ({})),
      courseId ? fetch(`/api/courses/${courseId}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
    ]).then(([userSettingsData, course]) => {
      const resolved = resolveSections({ course, userSettings: userSettingsData });
      setSections(resolved);
      if (!initial.sections) {
        setForm(f => {
          const seeded: Record<string, string> = { ...f.sections };
          for (const s of resolved) {
            if (!seeded[s.id]) {
              const legacyContent = getSectionContent(initial as Lesson, s.id);
              if (legacyContent) seeded[s.id] = legacyContent;
            }
          }
          return { ...f, sections: seeded };
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preSlideSections = sections.filter(s => (s.position ?? "after-slides") === "before-slides");
  const postSlideSections = sections.filter(s => (s.position ?? "after-slides") === "after-slides");

  const autoSaveRef = useRef(autoSave);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!autoSaveRef.current) return;
    setAutoSaveStatus("idle");
    const timer = setTimeout(async () => {
      if (!autoSaveRef.current) return;
      setAutoSaveStatus("saving");
      try {
        await autoSaveRef.current(form);
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [form]);

  function set(key: keyof LessonInput, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAiFill() {
    setAiFilling(true);
    setError("");
    try {
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { sections?: Record<string, string>; error?: string };
      if (!res.ok) throw new Error(data.error || "AI fill failed.");
      const { sections: aiSections } = data;
      const filled = new Set<string>();
      setForm((f) => {
        const nextSections = { ...f.sections };
        for (const [id, value] of Object.entries(aiSections ?? {})) {
          if (!nextSections[id]) {
            nextSections[id] = value;
            filled.add(id);
          }
        }
        return { ...f, sections: nextSections };
      });
      setAiFilledFields(prev => new Set([...prev, ...filled]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiFilling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Lesson Info ──────────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Lesson Info</p>
          <SectionClearBtn onClick={() => clearSection(["title","subtitle","topics","deadline","lessonType"])} />
        </div>

        <div>
          <label htmlFor="lessonform-lesson-title-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Lesson Title <span className="text-[var(--danger-text)]">*</span> {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}
          </label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Module number and lesson number (e.g. Module 3, Lesson 2)</p>
          <input id="lessonform-lesson-title-used-by-ai"
            required
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Module 3, Lesson 2"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="lessonform-lesson-subtitle-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Subtitle {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Specific topic or subject covered in this lesson</p>
          <input id="lessonform-lesson-subtitle-used-by-ai"
            type="text"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="e.g. Introduction to Persuasive Writing"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="lessonform-topics-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Topics {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}
          </label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Comma-separated. AI uses these to generate slide content, overviews, and quizzes.</p>
          <input id="lessonform-topics-used-by-ai"
            type="text"
            value={form.topics}
            onChange={(e) => set("topics", e.target.value)}
            placeholder="e.g. Claims, Evidence, Counterarguments"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lessonform-deadline" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline</label>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>The due date for this lesson&apos;s assignments.</p>
            <input id="lessonform-deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
              className={`${inputClass} ${form.deadline ? "" : "text-[var(--text-muted)]"}`}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="lessonform-lesson-type" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Type</label>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Classify the type of activity for this lesson.</p>
            <select id="lessonform-lesson-type"
              value={form.lessonType ?? "lesson"}
              onChange={(e) => set("lessonType", e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="lesson">Lesson</option>
              <option value="practice">Practice</option>
              <option value="project">Project</option>
              <option value="assessment">Assessment</option>
              <option value="review">Review</option>
            </select>
          </div>
        </div>

      </div>

      {/* ── AI Fill ──────────────────────────────────────────────────── */}
      {hasAiKey && (
        <div className={`relative rounded-3xl px-5 py-4 transition-all ${aiFilling ? "border-[#0cc0df]" : ""}`} style={{ background: aiFilling ? "var(--accent-bg)" : "var(--bg-card)", border: aiFilling ? "1px solid #0cc0df" : "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                AI Fill
                {aiFilledFields.size > 0 && !aiFilling && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#0cc0df] px-2 py-0.5 text-[10px] font-bold text-[#0a0b13] shadow-sm">
                    ✦ {aiFilledFields.size} field{aiFilledFields.size !== 1 ? "s" : ""} AI-generated
                  </span>
                )}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {aiFilling
                  ? "Generating content — this may take a few seconds…"
                  : "Fills only empty fields. Existing content is never overwritten."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiFill}
              disabled={aiFilling || saving || !form.title.trim()}
              title={!form.title.trim() ? "Enter a lesson title before using AI Fill" : undefined}
              className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-[#0a0b13] shadow hover:opacity-90 disabled:opacity-50 transition whitespace-nowrap"
            >
              {aiFilling ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Generating…
                </span>
              ) : "AI Fill"}
            </button>
          </div>
          {aiFilling && (
            <div className="mt-2 h-1 w-full rounded-full bg-[#0cc0df]/20 overflow-hidden">
              <div className="h-full bg-[#0cc0df] rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          )}
        </div>
      )}

      {/* ── Content Overview ─────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Content Overview</p>
          <SectionClearBtn onClick={() => clearSections(preSlideSections.map(s => s.id))} />
        </div>
        {preSlideSections.map(({ id, label, hint, rows }) => (
          <div key={id}>
            <label htmlFor={`lessonform-section-${id}`} className="flex items-center gap-2 text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {label}
              {aiFilledFields.has(id) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0cc0df] px-2 py-0.5 text-[10px] font-bold text-[#0a0b13] shadow-sm">✦ AI</span>
              )}
            </label>
            {hint && <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{hint}</p>}
            <textarea id={`lessonform-section-${id}`}
              value={form.sections?.[id] ?? ""}
              onChange={(e) => { setSection(id, e.target.value); setAiFilledFields(prev => { const next = new Set(prev); next.delete(id); return next; }); }}
              rows={rows ?? 4}
              className={`${inputClass} font-mono ${aiFilledFields.has(id) ? "ring-1 ring-[var(--focus-ring)]/50" : ""}`}
              style={{ ...inputStyle, borderColor: aiFilledFields.has(id) ? "rgba(12,192,223,0.4)" : "var(--border)" }}
            />
          </div>
        ))}
      </div>

      {/* ── Activities & Assessment ───────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Activities & Assessment</p>
          <SectionClearBtn onClick={() => clearSections(postSlideSections.map(s => s.id))} />
        </div>
        {postSlideSections.map(({ id, label, hint, rows }) => (
          <div key={id}>
            <label htmlFor={`lessonform-section-${id}`} className="flex items-center gap-2 text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {label}
              {aiFilledFields.has(id) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0cc0df] px-2 py-0.5 text-[10px] font-bold text-[#0a0b13] shadow-sm">✦ AI</span>
              )}
            </label>
            {hint && <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{hint}</p>}
            <textarea id={`lessonform-section-${id}`}
              value={form.sections?.[id] ?? ""}
              onChange={(e) => { setSection(id, e.target.value); setAiFilledFields(prev => { const next = new Set(prev); next.delete(id); return next; }); }}
              rows={rows ?? 4}
              className={`${inputClass} font-mono ${aiFilledFields.has(id) ? "ring-1 ring-[var(--focus-ring)]/50" : ""}`}
              style={{ ...inputStyle, borderColor: aiFilledFields.has(id) ? "rgba(12,192,223,0.4)" : "var(--border)" }}
            />
          </div>
        ))}
      </div>

      {/* ── Notes ───────────────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className={sectionLabel}>Instructor Notes</p>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>Not included in generation</span>
          </div>
          <SectionClearBtn onClick={() => clearSection(["notes"])} />
        </div>
        <textarea aria-label="Instructor notes"
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          placeholder="Private notes, reminders, or context for this lesson…"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div className="space-y-2">
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className={`rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2.5 text-sm font-semibold text-[#0a0b13] shadow hover:opacity-90 disabled:opacity-50 transition ${onCancel ? "flex-1" : "w-full"}`}
          >
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
        {autoSave && (
          <p className="text-xs text-right text-[var(--text-muted)]">
            {autoSaveStatus === "saving" && "Auto-saving…"}
            {autoSaveStatus === "saved" && "✓ Auto-saved"}
            {autoSaveStatus === "idle" && ""}
          </p>
        )}
      </div>
    </form>

    {/* Floating scroll-to-top button */}
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Back to top"
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-[#0cc0df] hover:opacity-80 shadow-lg flex items-center justify-center text-[#0a0b13] transition-all duration-200"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
    </>
  );
}
