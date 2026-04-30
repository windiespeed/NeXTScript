"use client";

import { useEffect, useRef, useState } from "react";
import type { Lesson, LessonInput } from "@/types/lesson";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/sectionLabels";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

interface Props {
  initial?: Partial<Lesson>;
  onSubmit: (data: LessonInput) => Promise<void>;
  onSaveDraft?: (data: LessonInput) => Promise<void>;
  autoSave?: (data: LessonInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  hasAiKey?: boolean;
  isEditing?: boolean;
}

interface Slide {
  title: string;
  body: string;
}

function parseSlides(raw: string): Slide[] {
  if (!raw.trim()) return [{ title: "", body: "" }];
  const sep = /\n---\n/;
  const blocks = sep.test(raw) ? raw.split(sep) : raw.split(/\n\n+/);
  return blocks.map((block) => {
    const lines = block.trim().split("\n");
    return { title: lines[0] ?? "", body: lines.slice(1).join("\n") };
  });
}

function serializeSlides(slides: Slide[]): string {
  return slides.map((s) => `${s.title}\n${s.body}`.trimEnd()).join("\n---\n");
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
};

type SectionField = { key: keyof LessonInput; label: string; hint: string; rows: number };

function buildPreSlideFields(l: SectionLabels): SectionField[] {
  return [
    { key: "overview",        label: "Lesson Overview",  hint: "Paragraph overview of everything covered in this lesson.", rows: 4 },
    { key: "learningTargets", label: "Learning Targets", hint: "3–8 bullet points of specific, measurable learning objectives.", rows: 4 },
    { key: "vocabulary",      label: "Vocabulary",       hint: "Key terms and definitions students need to know for this lesson.", rows: 4 },
    { key: "warmUp",          label: l.warmUp,           hint: "3–5 questions to engage students at the start of class.", rows: 4 },
  ];
}

function buildPostSlideFields(l: SectionLabels): SectionField[] {
  return [
    { key: "guidedLab",             label: l.guidedLab,             hint: "In-class instructor-led exercise. Must be step-by-step.", rows: 6 },
    { key: "selfPaced",             label: l.selfPaced,             hint: "Independent student exercise. Must be step-by-step.", rows: 6 },
    { key: "submissionChecklist",   label: l.submissionChecklist,   hint: "Specific requirements students must meet and turn in.", rows: 4 },
    { key: "checkpoint",            label: l.checkpoint,            hint: "Common problems and challenges students may face, with suggested solutions.", rows: 4 },
    { key: "industryBestPractices", label: l.industryBestPractices, hint: "Standards, best practices, and tips & tricks for this topic.", rows: 4 },
    { key: "devJournalPrompt",      label: l.devJournalPrompt,      hint: "3–5 specific, evidence-based reflection questions.", rows: 4 },
    { key: "rubric",                label: l.rubric,                hint: "Checklist used to assess student submissions.", rows: 4 },
  ];
}

export default function LessonForm({ initial = {}, onSubmit, onSaveDraft, autoSave, onCancel, submitLabel = "Save Lesson", hasAiKey = false, isEditing = false }: Props) {
  const [form, setForm] = useState<LessonInput>({ ...EMPTY, ...initial });
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initial.slideContent ?? ""));
  const [slideCount, setSlideCount] = useState<number>(initial.slideCount ?? 10);
  const [overviewSlides, setOverviewSlides] = useState<boolean[]>(() => {
    const count = parseSlides(initial.slideContent ?? "").length;
    const saved = initial.overviewSlides;
    if (saved && saved.length === count) return saved;
    return Array(count).fill(false);
  });
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [labels, setLabels] = useState<SectionLabels>(DEFAULT_SECTION_LABELS);

  function clearForm() {
    if (!confirm("Clear all fields? This cannot be undone.")) return;
    setForm({ ...EMPTY, sources: form.sources });
    setSlides([{ title: "", body: "" }]);
    setOverviewSlides([false]);
    setSlideCount(10);
    setAiFilledFields(new Set());
  }

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

  function SectionClearBtn({ onClick }: { onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-[10px] font-semibold rounded-full px-2 py-0.5 transition hover:bg-red-500/10 hover:text-red-500"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
      >
        Clear
      </button>
    );
  }

  useEffect(() => {
    fetch("/api/user/settings")
      .then(r => r.json())
      .then(s => {
        if (s.sectionLabels) setLabels({ ...DEFAULT_SECTION_LABELS, ...s.sectionLabels });
      })
      .catch(() => {});
  }, []);

  const PRE_SLIDE_FIELDS = buildPreSlideFields(labels);
  const POST_SLIDE_FIELDS = buildPostSlideFields(labels);

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
        await autoSaveRef.current({ ...form, slideContent: serializeSlides(slides), slideCount, overviewSlides });
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, slides, slideCount, overviewSlides]);

  function set(key: keyof LessonInput, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSlide(index: number, field: keyof Slide, value: string) {
    setSlides((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function addSlide() {
    setSlides((prev) => [...prev, { title: "", body: "" }]);
    setOverviewSlides((prev) => [...prev, false]);
  }

  function removeSlide(index: number) {
    setSlides((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    setOverviewSlides((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  function moveSlide(index: number, direction: "up" | "down") {
    const swapWith = direction === "up" ? index - 1 : index + 1;
    setSlides((prev) => {
      const next = [...prev];
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
    setOverviewSlides((prev) => {
      const next = [...prev];
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }

  async function handleAiFill() {
    setAiFilling(true);
    setError("");
    try {
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slideContent: serializeSlides(slides), slideCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI fill failed.");
      const { slides: aiSlides, ...fields } = data;
      const filled = new Set<string>();
      setForm((f) => {
        const next = { ...f };
        for (const [key, value] of Object.entries(fields)) {
          if (!f[key as keyof LessonInput]) {
            (next as any)[key] = value;
            filled.add(key);
          }
        }
        return next;
      });
      const currentSlideContent = serializeSlides(slides).trim();
      if (aiSlides?.length && !currentSlideContent) {
        setSlides(aiSlides);
        setOverviewSlides(Array(aiSlides.length).fill(false));
        filled.add("slideContent");
      }
      setAiFilledFields(prev => new Set([...prev, ...filled]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiFilling(false);
    }
  }

  async function handleSaveDraft() {
    if (!onSaveDraft) return;
    setSavingDraft(true);
    setError("");
    try {
      await onSaveDraft({ ...form, slideContent: serializeSlides(slides), slideCount, overviewSlides });
    } catch (err: any) {
      setError(err.message || "Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({ ...form, slideContent: serializeSlides(slides), slideCount, overviewSlides });
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
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

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
              className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition whitespace-nowrap"
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

      {/* ── Lesson Info ──────────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Lesson Info</p>
          <SectionClearBtn onClick={() => clearSection(["title","subtitle","topics","deadline","lessonType","sources","studentLevel"])} />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Lesson Title <span className="text-red-500">*</span>
          </label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Module number and lesson number (e.g. Module 3, Lesson 2)</p>
          <input
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
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Subtitle</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Specific topic or subject covered in this lesson</p>
          <input
            type="text"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="e.g. Introduction to CSS Flexbox"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Topics</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Enter topics comma-separated (e.g. HTML, CSS, Flexbox)</p>
          <input
            type="text"
            value={form.topics}
            onChange={(e) => set("topics", e.target.value)}
            placeholder="e.g. Flexbox, CSS Layout"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline</label>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>The due date for this lesson's assignments.</p>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
              className={`${inputClass} ${form.deadline ? "" : "text-[var(--text-muted)]"}`}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Type</label>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Classify the type of activity for this lesson.</p>
            <select
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

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Sources</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
            One URL per line. These are passed to the AI as reference material when generating lesson content.
            {form.sources
              ? isEditing
                ? " These are the sources saved with this lesson — edit as needed."
                : " The URLs below are pre-filled from your default sources — add, remove, or edit as needed for this lesson."
              : " No sources set — add URLs or configure defaults in your Profile settings."}
          </p>
          <textarea
            value={form.sources}
            onChange={(e) => set("sources", e.target.value)}
            rows={4}
            placeholder={"https://www.w3.org/\nhttps://www.w3schools.com/\nhttps://www.wcag.com/"}
            className={`${inputClass} font-mono`}
            style={inputStyle}
          />
        </div>

        {hasAiKey && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Student Level</label>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              Adjusts the tone and complexity of AI-generated content to match your students&apos; experience.
            </p>
            <div className="flex gap-3">
              {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="studentLevel"
                    value={level}
                    checked={(form.studentLevel ?? "beginner") === level}
                    onChange={() => set("studentLevel", level)}
                    className="accent-[#0cc0df]"
                  />
                  <span className="text-xs capitalize" style={{ color: "var(--text-primary)" }}>{level}</span>
                </label>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {(form.studentLevel ?? "beginner") === "beginner" && "No coding experience — simple language, extra explanation, no assumed knowledge."}
              {form.studentLevel === "intermediate" && "Some coding experience — moderate complexity, references prior knowledge."}
              {form.studentLevel === "advanced" && "Strong coding background — technical depth, industry terminology."}
            </p>
          </div>
        )}
      </div>

      {/* ── Content Overview ─────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Content Overview</p>
          <SectionClearBtn onClick={() => clearSection(PRE_SLIDE_FIELDS.map(f => f.key))} />
        </div>
        {PRE_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="flex items-center gap-2 text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {label}
              {aiFilledFields.has(key) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0cc0df] px-2 py-0.5 text-[10px] font-bold text-[#0a0b13] shadow-sm">✦ AI</span>
              )}
            </label>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{hint}</p>
            <textarea
              value={form[key] as string}
              onChange={(e) => { set(key, e.target.value); setAiFilledFields(prev => { const next = new Set(prev); next.delete(key); return next; }); }}
              rows={rows}
              className={`${inputClass} font-mono ${aiFilledFields.has(key) ? "ring-1 ring-[#0cc0df]/50" : ""}`}
              style={{ ...inputStyle, borderColor: aiFilledFields.has(key) ? "rgba(12,192,223,0.4)" : "var(--border)" }}
            />
          </div>
        ))}
      </div>

      {/* ── Slides ───────────────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Slides</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>AI slides:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={slideCount}
                onChange={e => setSlideCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                className="w-14 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                title="Number of slides AI will generate"
              />
            </div>
            <button
              type="button"
              onClick={() => { setSlides([{ title: "", body: "" }]); setOverviewSlides([true]); setAiFilledFields(prev => { const next = new Set(prev); next.delete("slideContent"); return next; }); }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-red-500/10 hover:text-red-500 text-[var(--text-muted)]"
              style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={addSlide}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              + Add Slide
            </button>
          </div>
        </div>
        <p className="text-xs -mt-2" style={{ color: "var(--text-secondary)" }}>Each card is one slide. The title becomes the slide heading.</p>

        <div className="space-y-3">
          {slides.map((slide, i) => (
            <div key={i} className="rounded-2xl p-4 space-y-2" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Slide {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOverviewSlides(prev => prev.map((v, idx) => idx === i ? !v : v))}
                    title={overviewSlides[i] ? "Included in Overview Doc — click to exclude" : "Excluded from Overview Doc — click to include"}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${overviewSlides[i] ? "bg-[#0cc0df]/15 text-[#0cc0df]" : "text-[var(--text-muted)] hover:bg-[var(--bg-card)]"}`}
                    style={overviewSlides[i] ? {} : { border: "1px solid var(--border)" }}
                  >
                    Overview
                  </button>
                  <button type="button" onClick={() => moveSlide(i, "up")} disabled={i === 0} title="Move up" className="p-1 rounded text-[var(--text-muted)] hover:text-[#0cc0df] disabled:opacity-20 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button type="button" onClick={() => moveSlide(i, "down")} disabled={i === slides.length - 1} title="Move down" className="p-1 rounded text-[var(--text-muted)] hover:text-[#0cc0df] disabled:opacity-20 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <button type="button" onClick={() => removeSlide(i)} disabled={slides.length === 1} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 transition ml-1">
                    Remove
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => setSlide(i, "title", e.target.value)}
                placeholder="Slide title"
                className={inputClass}
                style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <textarea
                value={slide.body}
                onChange={(e) => setSlide(i, "body", e.target.value)}
                rows={4}
                placeholder="Slide content…"
                className={`${inputClass} font-mono`}
                style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Activities & Assessment ───────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Activities & Assessment</p>
          <SectionClearBtn onClick={() => clearSection(POST_SLIDE_FIELDS.map(f => f.key))} />
        </div>
        {POST_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="flex items-center gap-2 text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {label}
              {aiFilledFields.has(key) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0cc0df] px-2 py-0.5 text-[10px] font-bold text-[#0a0b13] shadow-sm">✦ AI</span>
              )}
            </label>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{hint}</p>
            <textarea
              value={form[key] as string}
              onChange={(e) => { set(key, e.target.value); setAiFilledFields(prev => { const next = new Set(prev); next.delete(key); return next; }); }}
              rows={rows}
              className={`${inputClass} font-mono ${aiFilledFields.has(key) ? "ring-1 ring-[#0cc0df]/50" : ""}`}
              style={{ ...inputStyle, borderColor: aiFilledFields.has(key) ? "rgba(12,192,223,0.4)" : "var(--border)" }}
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
        <textarea
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
              disabled={saving || savingDraft}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              Cancel
            </button>
          )}
          {onSaveDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || savingDraft}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-50 transition"
              style={{ border: "1px solid var(--border)", background: "var(--bg-card-hover)", color: "var(--text-primary)" }}
            >
              {savingDraft ? "Saving…" : "Save Draft"}
            </button>
          )}
          <button
            type="submit"
            disabled={saving || savingDraft}
            className={`rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition ${onCancel || onSaveDraft ? "flex-1" : "w-full"}`}
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
