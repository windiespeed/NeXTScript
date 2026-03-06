"use client";

import { useState } from "react";
import type { Lesson, LessonInput } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { emptyQuestion } from "@/types/form";

interface Props {
  initial?: Partial<Lesson>;
  onSubmit: (data: LessonInput) => Promise<void>;
  submitLabel?: string;
}

interface Slide {
  title: string;
  body: string;
}

function parseSlides(raw: string): Slide[] {
  if (!raw.trim()) return [{ title: "", body: "" }];
  return raw.split(/\n\n+/).map((block) => {
    const lines = block.split("\n");
    return { title: lines[0] ?? "", body: lines.slice(1).join("\n") };
  });
}

function serializeSlides(slides: Slide[]): string {
  return slides.map((s) => `${s.title}\n${s.body}`.trimEnd()).join("\n\n");
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

export default function LessonForm({ initial = {}, onSubmit, submitLabel = "Save Lesson" }: Props) {
  const [form, setForm] = useState<LessonInput>({ ...EMPTY, ...initial });
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initial.slideContent ?? ""));
  const [quizQuestions, setQuizQuestions] = useState<FormQuestion[]>(
    () => (initial.quizQuestions && initial.quizQuestions.length > 0)
      ? initial.quizQuestions
      : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
          <label className="block text-sm font-semibold text-black mb-1">
            Lesson Title <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-black mb-1">Module number and lesson number (e.g. Module 3, Lesson 2)</p>
          <input
            required
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Module 3, Lesson 2"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-black mb-1">Lesson Subtitle</label>
          <p className="text-xs text-black mb-1">Specific topic or subject covered in this lesson</p>
          <input
            type="text"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="e.g. Introduction to CSS Flexbox"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-black mb-1">Topics</label>
          <input
            type="text"
            value={form.topics}
            onChange={(e) => set("topics", e.target.value)}
            placeholder="e.g. Flexbox, CSS Layout"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-black mb-1">Deadline</label>
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => set("deadline", e.target.value)}
            className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-900 ${form.deadline ? "text-black" : "text-gray-500"}`}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-black mb-1">Sources</label>
          <p className="text-xs text-black mb-1">
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

      {/* ── Pre-slide content sections ────────────────────────────────── */}
      <div className="space-y-5">
        {PRE_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-black mb-1">{label}</label>
            <p className="text-xs text-black mb-1">{hint}</p>
            <textarea
              value={form[key] as string}
              onChange={(e) => set(key, e.target.value)}
              rows={rows}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black font-mono shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>
        ))}
      </div>

      {/* ── Slides ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-black">Slide Content</p>
            <p className="text-xs text-black">Each card is one slide. The title becomes the slide heading.</p>
          </div>
          <button
            type="button"
            onClick={addSlide}
            className="rounded-md bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 transition"
          >
            + Add Slide
          </button>
        </div>

        <div className="space-y-3">
          {slides.map((slide, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slide {i + 1}</span>
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black bg-white shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <textarea
                value={slide.body}
                onChange={(e) => setSlide(i, "body", e.target.value)}
                rows={4}
                placeholder="Slide content…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black font-mono bg-white shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Post-slide content sections ───────────────────────────────── */}
      <div className="space-y-5">
        {POST_SLIDE_FIELDS.map(({ key, label, hint, rows }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-black mb-1">{label}</label>
            <p className="text-xs text-black mb-1">{hint}</p>
            <textarea
              value={form[key] as string}
              onChange={(e) => set(key, e.target.value)}
              rows={rows}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black font-mono shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>
        ))}
      </div>

      {/* ── Quiz Questions ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-black">Quiz Questions</p>
            <p className="text-xs text-black">Optional — define custom questions for the generated quiz. If left empty, questions are auto-generated from the Rubric.</p>
          </div>
          <button
            type="button"
            onClick={() => setQuizQuestions(prev => [...prev, emptyQuestion(`q_${Date.now()}`)])}
            className="rounded-md bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 transition"
          >
            + Add Question
          </button>
        </div>

        <div className="space-y-4">
          {quizQuestions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question {i + 1}</span>
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
                  <label className="block text-xs font-semibold text-black mb-1">Question</label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                    placeholder="Enter question text"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black bg-white shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-black mb-1">Type</label>
                  <select
                    value={q.type}
                    onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, type: e.target.value as FormQuestion["type"] } : x))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-black bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
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
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-black bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
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
                    className="text-xs text-blue-700 hover:text-blue-900 transition"
                  >
                    + Add option
                  </button>

                  <div>
                    <label className="block text-xs font-semibold text-black mt-2 mb-1">Correct Answer (optional — for grading)</label>
                    <select
                      value={q.correctAnswer}
                      onChange={e => setQuizQuestions(prev => prev.map((x, idx) => idx === i ? { ...x, correctAnswer: e.target.value } : x))}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-black bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="">— None —</option>
                      {q.options.filter(o => o.trim()).map((o, oi) => (
                        <option key={oi} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-black cursor-pointer">
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

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-800 disabled:opacity-50 transition"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
