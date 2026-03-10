"use client";

import { useState } from "react";
import type { Lesson, LessonInput } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { emptyQuestion } from "@/types/form";

interface Props {
  initial?: Partial<Lesson>;
  onSubmit: (data: LessonInput) => Promise<void>;
  onBundle?: (data: LessonInput) => Promise<{ folderUrl: string }>;
  onCancel?: () => void;
  submitLabel?: string;
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
  overview: "",
  learningTargets: "",
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
};

type SectionField = { key: keyof LessonInput; label: string; hint: string; rows: number };

// Sections that appear BEFORE the slide content cards (matches Google Doc order)
const PRE_SLIDE_FIELDS: SectionField[] = [
  { key: "overview",         label: "Lesson Overview",    hint: "Paragraph overview of everything covered in this lesson.", rows: 4 },
  { key: "learningTargets",  label: "Learning Targets",   hint: "3–8 bullet points of specific, measurable learning objectives.", rows: 4 },
  { key: "warmUp",           label: "Warm-Up",            hint: "3–5 questions to engage students at the start of class.", rows: 4 },
];

// Sections that appear AFTER the slide content cards (matches Google Doc order)
const POST_SLIDE_FIELDS: SectionField[] = [
  { key: "guidedLab",             label: "Guided Lab",                hint: "In-class instructor-led exercise. Must be step-by-step, including file/folder naming.", rows: 6 },
  { key: "selfPaced",             label: "Self-Paced",                hint: "Independent student exercise. Must be step-by-step, including file/folder naming.", rows: 6 },
  { key: "submissionChecklist",   label: "Submission Checklist",      hint: "Specific requirements students must meet and turn in.", rows: 4 },
  { key: "checkpoint",            label: "Checkpoint",                hint: "Common problems and challenges students may face, with suggested solutions.", rows: 4 },
  { key: "industryBestPractices", label: "Industry Best Practices",   hint: "Industry standards, best practices, and tips & tricks for this topic.", rows: 4 },
  { key: "devJournalPrompt",      label: "Development Journal Prompt", hint: "Copy/paste into dev journal. 3–5 specific, evidence-based reflection questions.", rows: 4 },
  { key: "rubric",                label: "Rubric",                    hint: "Comprehension and objective checklist used by TAs to assess student submissions.", rows: 4 },
];

export default function LessonForm({ initial = {}, onSubmit, onBundle, onCancel, submitLabel = "Save Lesson" }: Props) {
  const [form, setForm] = useState<LessonInput>({ ...EMPTY, ...initial });
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initial.slideContent ?? ""));
  const [quizQuestions, setQuizQuestions] = useState<FormQuestion[]>(
    () => (initial.quizQuestions && initial.quizQuestions.length > 0)
      ? initial.quizQuestions
      : []
  );
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [bundleStep, setBundleStep] = useState<null | "ai" | "saving" | "bundling">(null);
  const [creditsError, setCreditsError] = useState(false);
  const [error, setError] = useState("");

  async function callAIFill(currentForm: LessonInput): Promise<LessonInput | null> {
    const res = await fetch("/api/ai/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: currentForm.title, subtitle: currentForm.subtitle, topics: currentForm.topics, sources: currentForm.sources }),
    });
    const data = await res.json();
    if (data.creditsError) {
      setCreditsError(true);
      return null;
    }
    if (!res.ok) throw new Error(data.error || "AI generation failed");
    const filled = { ...currentForm, ...data };
    setForm(filled);
    if (data.slideContent) setSlides(parseSlides(data.slideContent));
    return filled;
  }

  async function handleAIGenerate() {
    if (!form.title.trim()) return;
    setAiGenerating(true);
    setCreditsError(false);
    setError("");
    try {
      await callAIFill(form);
    } catch (err: any) {
      setError(err.message || "AI generation failed.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleBundle() {
    if (!onBundle || !form.title.trim()) return;
    setBundleStep("ai");
    setCreditsError(false);
    setError("");
    try {
      const filled = await callAIFill(form);
      if (!filled) { setBundleStep(null); return; }
      const finalData = { ...filled, slideContent: serializeSlides(slides), quizQuestions };
      setBundleStep("saving");
      await new Promise(r => setTimeout(r, 0)); // flush state
      setBundleStep("bundling");
      await onBundle(finalData);
    } catch (err: any) {
      setError(err.message || "Bundle generation failed.");
    } finally {
      setBundleStep(null);
    }
  }

  function set(key: keyof LessonInput, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSlide(index: number, field: keyof Slide, value: string) {
    setSlides((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function addSlide() {
    setSlides((prev) => [...prev, { title: "", body: "" }]);
  }

  function removeSlide(index: number) {
    setSlides((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({ ...form, slideContent: serializeSlides(slides), quizQuestions });
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Meta fields ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white mb-1">
            Lesson Title <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-1">Module number and lesson number (e.g. Module 3, Lesson 2)</p>
          <input
            required
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Module 3, Lesson 2"
            className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white mb-1">Lesson Subtitle</label>
          <p className="text-xs text-gray-500 mb-1">Specific topic or subject covered in this lesson</p>
          <input
            type="text"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="e.g. Introduction to CSS Flexbox"
            className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white mb-1">Topics</label>
          <input
            type="text"
            value={form.topics}
            onChange={(e) => set("topics", e.target.value)}
            placeholder="e.g. Flexbox, CSS Layout"
            className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white mb-1">Deadline</label>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => set("deadline", e.target.value)}
            className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-900 ${form.deadline ? "text-black" : "text-gray-500"}`}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white mb-1">Sources</label>
          <p className="text-xs text-gray-500 mb-1">
            Reference URLs used to generate this lesson — one URL per line (e.g. W3C specs, MDN docs, W3Schools pages).
          </p>
          <textarea
            value={form.sources}
            onChange={(e) => set("sources", e.target.value)}
            rows={4}
            placeholder={"https://www.w3.org/\nhttps://www.w3schools.com/\nhttps://www.wcag.com/"}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black font-mono shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>
      </div>

      {/* ── AI Fill ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#0cc0df]/40 bg-gradient-to-br from-[#0d1c35] to-[#0d2a45] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Fill with AI</p>
            <p className="text-xs text-[#0cc0df] mt-0.5">
              {onBundle
                ? "Fill in the title (and optionally subtitle, topics, sources), then use one of the buttons to generate content only or generate + create the Drive bundle in one step."
                : "Generates all content sections below using Claude. Fill in the title (and optionally subtitle, topics, sources) first."}
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiGenerating || !!bundleStep || !form.title.trim()}
              className="rounded-md bg-[#1e4a85] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a5a9a] disabled:opacity-40 transition"
            >
              {aiGenerating ? "Generating…" : "Fill with AI"}
            </button>
            {onBundle && (
              <button
                type="button"
                onClick={handleBundle}
                disabled={aiGenerating || !!bundleStep || !form.title.trim()}
                className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
              >
                {bundleStep === "ai" ? "Generating content…"
                  : bundleStep === "saving" ? "Saving lesson…"
                  : bundleStep === "bundling" ? "Creating Drive bundle…"
                  : "AI + Generate Bundle"}
              </button>
            )}
          </div>
        </div>
        {creditsError && (
          <div className="mt-3 rounded-md bg-amber-900/40 border border-amber-400/50 p-2.5 text-amber-300 text-xs font-medium">
            AI credits exhausted.
          </div>
        )}
      </div>

      {/* ── Pre-slide content sections ────────────────────────────────── */}
      <div className="space-y-5">
        {PRE_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white mb-1">
              {label} <span className="ml-1 text-[10px] font-semibold text-[#0cc0df] bg-[#0cc0df]/10 border border-[#0cc0df]/30 rounded px-1 py-0.5">AI</span>
            </label>
            <p className="text-xs text-gray-500 mb-1">{hint}</p>
            <textarea
              value={form[key] as string}
              onChange={(e) => set(key, e.target.value)}
              rows={rows}
              className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] font-mono shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
            />
          </div>
        ))}
      </div>

      {/* ── Slides ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[#0d1c35]">
              Slide Content <span className="ml-1 text-[10px] font-semibold text-[#0cc0df] bg-[#0cc0df]/10 border border-[#0cc0df]/30 rounded px-1 py-0.5">AI</span>
            </p>
            <p className="text-xs text-gray-500">Each card is one slide. The title becomes the slide heading.</p>
          </div>
          <button
            type="button"
            onClick={addSlide}
            className="rounded-md bg-[#0d1c35] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e4a85] transition"
          >
            + Add Slide
          </button>
        </div>

        <div className="space-y-3">
          {slides.map((slide, i) => (
            <div key={i} className="rounded-lg border border-[#1e4a85]/20 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#0d1c35]/50 uppercase tracking-wide">Slide {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeSlide(i)}
                  disabled={slides.length === 1}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 transition"
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                value={slide.title}
                onChange={(e) => setSlide(i, "title", e.target.value)}
                placeholder="Slide title"
                className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
              />
              <textarea
                value={slide.body}
                onChange={(e) => setSlide(i, "body", e.target.value)}
                rows={4}
                placeholder="Slide content…"
                className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] font-mono bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Post-slide content sections ───────────────────────────────── */}
      <div className="space-y-5">
        {POST_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white mb-1">
              {label} <span className="ml-1 text-[10px] font-semibold text-[#0cc0df] bg-[#0cc0df]/10 border border-[#0cc0df]/30 rounded px-1 py-0.5">AI</span>
            </label>
            <p className="text-xs text-gray-500 mb-1">{hint}</p>
            <textarea
              value={form[key] as string}
              onChange={(e) => set(key, e.target.value)}
              rows={rows}
              className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] font-mono shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
            />
          </div>
        ))}
      </div>

      {/* ── Quiz Questions ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-[#0d1c35]">
              Quiz Questions <span className="ml-1 text-[10px] font-semibold text-[#0cc0df] bg-[#0cc0df]/10 border border-[#0cc0df]/30 rounded px-1 py-0.5">AI</span>
            </p>
            <p className="text-xs text-gray-500">Optional — define custom questions. If left empty, AI will generate 10 multiple choice + 2 short answer questions when you generate the bundle.</p>
          </div>
          <button
            type="button"
            onClick={() => setQuizQuestions(prev => [...prev, emptyQuestion(`q_${Date.now()}`)])}
            className="rounded-md bg-[#0d1c35] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e4a85] transition"
          >
            + Add Question
          </button>
        </div>

        <div className="space-y-4">
          {quizQuestions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-[#1e4a85]/20 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#0d1c35]/50 uppercase tracking-wide">Question {i + 1}</span>
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
                  <label className="block text-xs font-semibold text-[#0d1c35] mb-1">Question</label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                    placeholder="Enter question text"
                    className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0d1c35] mb-1">Type</label>
                  <select
                    value={q.type}
                    onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, type: e.target.value as FormQuestion["type"] } : x))}
                    className="rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#0d1c35] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="paragraph">Paragraph</option>
                  </select>
                </div>
              </div>

              {q.type === "multiple_choice" && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-black">Answer Options</label>
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
                        className="flex-1 rounded-md border border-[#1e4a85]/30 px-3 py-1.5 text-sm text-[#0d1c35] bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
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
                    className="text-xs text-[#0cc0df] hover:text-[#1e4a85] transition"
                  >
                    + Add option
                  </button>

                  <div>
                    <label className="block text-xs font-semibold text-black mt-2 mb-1">Correct Answer (optional — for grading)</label>
                    <select
                      value={q.correctAnswer}
                      onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, correctAnswer: e.target.value } : x))}
                      className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-1.5 text-sm text-[#0d1c35] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                    >
                      <option value="">— None —</option>
                      {q.options.filter(o => o.trim()).map((o, oi) => (
                        <option key={oi} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-[#0d1c35] cursor-pointer">
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

      <div className={`flex gap-3 ${onCancel ? "" : ""}`}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || !!bundleStep}
            className="flex-1 rounded-md border border-[#1e4a85] px-4 py-2.5 text-sm font-semibold text-[#0d1c35] dark:text-white hover:bg-[#1e4a85]/10 disabled:opacity-50 transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving || !!bundleStep}
          className={`rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition ${onCancel ? "flex-1" : "w-full"}`}
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
