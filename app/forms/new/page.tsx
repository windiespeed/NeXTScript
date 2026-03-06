"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { FormQuestion } from "@/types/form";
import { emptyQuestion } from "@/types/form";

export default function NewFormPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isQuiz, setIsQuiz] = useState(false);
  const [questions, setQuestions] = useState<FormQuestion[]>([emptyQuestion(`q_${Date.now()}`)]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState("");

  if (status === "loading") return null;
  if (!session) {
    router.replace("/");
    return null;
  }

  function updateQuestion(i: number, patch: Partial<FormQuestion>) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (questions.filter(q => q.text.trim()).length === 0) { setError("Add at least one question."); return; }

    setGenerating(true);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, questions, isQuiz }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult({ url: data.url });
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#112543] dark:text-white">Form Builder</h1>
        <p className="text-sm text-gray-500 mt-1">Create a custom Google Form — surveys, quizzes, feedback, and more.</p>
      </div>

      {result && (
        <div className="mb-6 rounded-md bg-[#2dd4a0]/10 border border-[#2dd4a0] p-4">
          <p className="text-sm font-semibold text-[#112543] mb-1">Form created!</p>
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0cc0df] underline break-all">
            Open in Google Forms
          </a>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Meta */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#112543] dark:text-white mb-1">
              Form Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. End of Unit Survey"
              className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#112543] dark:text-white mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description shown at the top of the form"
              className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#112543] dark:text-white cursor-pointer">
            <input
              type="checkbox"
              checked={isQuiz}
              onChange={e => setIsQuiz(e.target.checked)}
              className="rounded"
            />
            Make this a graded quiz
          </label>
        </div>

        {/* Questions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-[#112543] dark:text-white">Questions</p>
              <p className="text-xs text-gray-500">Add questions for your form.</p>
            </div>
            <button
              type="button"
              onClick={() => setQuestions(prev => [...prev, emptyQuestion(`q_${Date.now()}`)])}
              className="rounded-md bg-[#112543] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e4a85] transition"
            >
              + Add Question
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-[#1e4a85]/20 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setQuestions(prev => prev.filter((_, idx) => idx !== i))}
                    disabled={questions.length === 1}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 transition"
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
                      onChange={e => updateQuestion(i, { text: e.target.value })}
                      placeholder="Enter question text"
                      className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] bg-white shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-black mb-1">Type</label>
                    <select
                      value={q.type}
                      onChange={e => updateQuestion(i, { type: e.target.value as FormQuestion["type"] })}
                      className="rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
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
                          onChange={e => updateQuestion(i, { options: q.options.map((o, oIdx) => oIdx === oi ? e.target.value : o) })}
                          placeholder={`Option ${oi + 1}`}
                          className="flex-1 rounded-md border border-[#1e4a85]/30 px-3 py-1.5 text-sm text-[#112543] bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuestion(i, { options: q.options.filter((_, oIdx) => oIdx !== oi) })}
                          disabled={q.options.length <= 2}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateQuestion(i, { options: [...q.options, ""] })}
                      className="text-xs text-[#0cc0df] hover:text-[#1e4a85] transition"
                    >
                      + Add option
                    </button>

                    {isQuiz && (
                      <div>
                        <label className="block text-xs font-semibold text-black mt-2 mb-1">Correct Answer (for grading)</label>
                        <select
                          value={q.correctAnswer}
                          onChange={e => updateQuestion(i, { correctAnswer: e.target.value })}
                          className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-1.5 text-sm text-[#112543] bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                        >
                          <option value="">— None —</option>
                          {q.options.filter(o => o.trim()).map((o, oi) => (
                            <option key={oi} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={e => updateQuestion(i, { required: e.target.checked })}
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
          disabled={generating}
          className="w-full rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
        >
          {generating ? "Generating…" : "Generate Form"}
        </button>
      </form>
    </main>
  );
}
