"use client";

import { useEffect, useRef, useState } from "react";
import type { Lesson, LessonInput } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { emptyQuestion } from "@/types/form";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/sectionLabels";

interface Props {
  initial?: Partial<Lesson>;
  onSubmit: (data: LessonInput) => Promise<void>;
  onSaveDraft?: (data: LessonInput) => Promise<void>;
  autoSave?: (data: LessonInput) => Promise<void>;
  onCancel?: () => void;
  onClearRef?: (clearFn: () => void) => void;
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

export default function LessonForm({ initial = {}, onSubmit, onSaveDraft, autoSave, onCancel, onClearRef, submitLabel = "Save Lesson", hasAiKey = false, isEditing = false }: Props) {
  const [form, setForm] = useState<LessonInput>({ ...EMPTY, ...initial });
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initial.slideContent ?? ""));
  const [slideCount, setSlideCount] = useState<number>(initial.slideCount ?? 10);
  const [overviewSlides, setOverviewSlides] = useState<boolean[]>(() => {
    const count = parseSlides(initial.slideContent ?? "").length;
    const saved = initial.overviewSlides;
    if (saved && saved.length === count) return saved;
    return Array(count).fill(true);
  });
  const [quizQuestions, setQuizQuestions] = useState<FormQuestion[]>(
    () => (initial.quizQuestions && initial.quizQuestions.length > 0)
      ? initial.quizQuestions
      : []
  );
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [aiQuizGenerating, setAiQuizGenerating] = useState(false);
  const [aiQuizError, setAiQuizError] = useState("");
  const [quizMcCount, setQuizMcCount] = useState(8);
  const [quizSaCount, setQuizSaCount] = useState(2);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [labels, setLabels] = useState<SectionLabels>(DEFAULT_SECTION_LABELS);

  function clearForm() {
    if (!confirm("Clear all fields? This cannot be undone.")) return;
    setForm({ ...EMPTY });
    setSlides([{ title: "", body: "" }]);
    setOverviewSlides([true]);
    setSlideCount(10);
    setQuizQuestions([]);
    setAiFilledFields(new Set());
  }

  useEffect(() => {
    onClearRef?.(clearForm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        await autoSaveRef.current({ ...form, slideContent: serializeSlides(slides), quizQuestions, slideCount, overviewSlides });
        setAutoSaveStatus("saved");
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, slides, quizQuestions, slideCount, overviewSlides]);

  function set(key: keyof LessonInput, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSlide(index: number, field: keyof Slide, value: string) {
    setSlides((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function addSlide() {
    setSlides((prev) => [...prev, { title: "", body: "" }]);
    setOverviewSlides((prev) => [...prev, true]);
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

  async function handleAiGenerateQuiz() {
    setAiQuizGenerating(true);
    setAiQuizError("");
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson: { ...form, slideContent: serializeSlides(slides) },
          mcCount: quizMcCount,
          saCount: quizSaCount,
          courseId: form.courseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quiz generation failed.");
      // Append generated questions with fresh IDs to avoid key collisions
      const stamped = (data as import("@/types/form").FormQuestion[]).map(q => ({
        ...q,
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      }));
      setQuizQuestions(prev => [...prev, ...stamped]);
    } catch (err: any) {
      setAiQuizError(err.message || "Quiz generation failed.");
    } finally {
      setAiQuizGenerating(false);
    }
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
        setOverviewSlides(Array(aiSlides.length).fill(true));
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
      await onSaveDraft({ ...form, slideContent: serializeSlides(slides), quizQuestions, slideCount, overviewSlides });
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
      await onSubmit({ ...form, slideContent: serializeSlides(slides), quizQuestions, slideCount, overviewSlides });
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── AI Fill ──────────────────────────────────────────────────── */}
      {hasAiKey && (
        <div className={`relative rounded-lg border px-4 py-3 transition-all ${aiFilling ? "border-[#0cc0df]" : "border-[var(--border)]"}`} style={{ background: aiFilling ? "var(--accent-bg)" : "var(--bg-card)" }}>
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

      {/* ── Meta fields ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Lesson Title <span className="text-red-500">*</span>
          </label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Module number and lesson number (e.g. Module 3, Lesson 2)</p>
          <input
            required
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Module 3, Lesson 2"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Subtitle</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Specific topic or subject covered in this lesson</p>
          <input
            type="text"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="e.g. Introduction to CSS Flexbox"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Topics</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Enter topics comma-separated (e.g. HTML, CSS, Flexbox)</p>
          <input
            type="text"
            value={form.topics}
            onChange={(e) => set("topics", e.target.value)}
            placeholder="e.g. Flexbox, CSS Layout"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>The due date for this lesson's assignments.</p>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => set("deadline", e.target.value)}
            className={`w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df] ${form.deadline ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Type</label>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Classify the type of activity for this lesson.</p>
          <select
            value={form.lessonType ?? "lesson"}
            onChange={(e) => set("lessonType", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          >
            <option value="lesson">Lesson</option>
            <option value="practice">Practice</option>
            <option value="project">Project</option>
            <option value="assessment">Assessment</option>
            <option value="review">Review</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Sources</label>
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
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
        </div>

        {hasAiKey && <div className="sm:col-span-2">
          <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Student Level</label>
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
                <span className="text-sm capitalize" style={{ color: "var(--text-primary)" }}>{level}</span>
              </label>
            ))}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {(form.studentLevel ?? "beginner") === "beginner" && "No coding experience — simple language, extra explanation, no assumed knowledge."}
            {form.studentLevel === "intermediate" && "Some coding experience — moderate complexity, references prior knowledge."}
            {form.studentLevel === "advanced" && "Strong coding background — technical depth, industry terminology."}
          </p>
        </div>}
      </div>

      {/* ── Pre-slide content sections ────────────────────────────────── */}
      <div className="space-y-5">
        {PRE_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-1">
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
              className={`w-full rounded-lg border px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df] bg-[var(--bg-card)] ${aiFilledFields.has(key) ? "border-[#0cc0df]/50" : "border-[var(--border)]"}`}
            />
          </div>
        ))}
      </div>

      {/* ── Slides ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Slide Content</p>
            <p className="text-xs text-[var(--text-secondary)]">Each card is one slide. The title becomes the slide heading.</p>
          </div>
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
              onClick={addSlide}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] transition"
            >
              + Add Slide
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {slides.map((slide, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Slide {i + 1}</span>
                <div className="flex items-center gap-1">
                  {/* Overview Doc toggle */}
                  <button
                    type="button"
                    onClick={() => setOverviewSlides(prev => prev.map((v, idx) => idx === i ? !v : v))}
                    title={overviewSlides[i] ? "Included in Overview Doc — click to exclude" : "Excluded from Overview Doc — click to include"}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${overviewSlides[i] ? "bg-[#0cc0df]/15 text-[#0cc0df]" : "text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"}`}
                    style={overviewSlides[i] ? {} : { border: "1px solid var(--border)" }}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide(i, "up")}
                    disabled={i === 0}
                    title="Move up"
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[#0cc0df] disabled:opacity-20 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide(i, "down")}
                    disabled={i === slides.length - 1}
                    title="Move down"
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[#0cc0df] disabled:opacity-20 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlide(i)}
                    disabled={slides.length === 1}
                    className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-30 transition ml-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => setSlide(i, "title", e.target.value)}
                placeholder="Slide title"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
              />
              <textarea
                value={slide.body}
                onChange={(e) => setSlide(i, "body", e.target.value)}
                rows={4}
                placeholder="Slide content…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Post-slide content sections ───────────────────────────────── */}
      <div className="space-y-5">
        {POST_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-1">
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
              className={`w-full rounded-lg border px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df] bg-[var(--bg-card)] ${aiFilledFields.has(key) ? "border-[#0cc0df]/50" : "border-[var(--border)]"}`}
            />
          </div>
        ))}
      </div>

      {/* ── Quiz Questions ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Quiz Questions</p>
            <p className="text-xs text-[var(--text-secondary)]">Optional — define custom questions for the quiz form.</p>
          </div>
          <button
            type="button"
            onClick={() => setQuizQuestions(prev => [...prev, emptyQuestion(`q_${Date.now()}`)])}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] transition"
          >
            + Add Question
          </button>
        </div>

        {/* AI Generate row */}
        {hasAiKey && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" style={{ color: "#0cc0df" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <span className="text-xs font-semibold shrink-0" style={{ color: "var(--text-secondary)" }}>AI Generate</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min={0}
                max={50}
                value={quizMcCount}
                onChange={e => setQuizMcCount(Math.min(50, Math.max(0, Number(e.target.value))))}
                className="w-12 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>MC</span>
              <input
                type="number"
                min={0}
                max={50}
                value={quizSaCount}
                onChange={e => setQuizSaCount(Math.min(50, Math.max(0, Number(e.target.value))))}
                className="w-12 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>SA</span>
            </div>
            <button
              type="button"
              onClick={handleAiGenerateQuiz}
              disabled={aiQuizGenerating}
              className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
              style={{ background: "#0cc0df" }}
            >
              {aiQuizGenerating ? "Generating…" : "Generate & Append"}
            </button>
            {aiQuizError && <p className="text-xs text-red-500 ml-2">{aiQuizError}</p>}
          </div>
        )}

        <div className="space-y-4">
          {quizQuestions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Question {i + 1}</span>
                <button
                  type="button"
                  onClick={() => setQuizQuestions(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-500 hover:text-red-700 transition"
                >
                  Remove
                </button>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">Question</label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                    placeholder="Enter question text"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">Type</label>
                  <select
                    value={q.type}
                    onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, type: e.target.value as FormQuestion["type"] } : x))}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="paragraph">Paragraph</option>
                  </select>
                </div>
              </div>

              {q.type === "multiple_choice" && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">Answer Options</label>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i
                          ? { ...x, options: x.options.map((o, oIdx) => oIdx === oi ? e.target.value : o) }
                          : x
                        ))}
                        placeholder={`Option ${oi + 1}`}
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                      />
                      <button
                        type="button"
                        onClick={() => setQuizQuestions(prev => prev.map((x, idx) => idx === i
                          ? { ...x, options: x.options.filter((_, oIdx) => oIdx !== oi) }
                          : x
                        ))}
                        disabled={q.options.length <= 2}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, options: [...x.options, ""] } : x))}
                    className="text-xs text-[#0cc0df] hover:opacity-70 transition"
                  >
                    + Add option
                  </button>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mt-2 mb-1">Correct Answer (optional — for grading)</label>
                    <select
                      value={q.correctAnswer}
                      onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, correctAnswer: e.target.value } : x))}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                    >
                      <option value="">— None —</option>
                      {q.options.filter(o => o.trim()).map((o, oi) => (
                        <option key={oi} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, required: e.target.checked } : x))}
                  className="rounded"
                />
                Required
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────────────────── */}
      <div className="rounded-lg p-4 space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Instructor Notes</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>Not included in generation</span>
        </div>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          placeholder="Private notes, reminders, or context for this lesson…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card-hover)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
        />
      </div>

      <div className="space-y-2">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={clearForm}
            disabled={saving || savingDraft}
            className="rounded-md border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition"
          >
            Clear
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || savingDraft}
              className="flex-1 rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 transition"
            >
              Cancel
            </button>
          )}
          {onSaveDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || savingDraft}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-card-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:opacity-80 disabled:opacity-50 transition"
            >
              {savingDraft ? "Saving…" : "Save Draft"}
            </button>
          )}
          <button
            type="submit"
            disabled={saving || savingDraft}
            className={`rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition ${onCancel || onSaveDraft ? "flex-1" : "w-full"}`}
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
