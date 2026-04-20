"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Course, CourseModule } from "@/types/course";
import type { Lesson } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { emptyQuestion } from "@/types/form";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

export default function EditQuizPage() {
  useSession({ required: true });
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Quiz content
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");

  // AI
  const [mcCount, setMcCount] = useState(8);
  const [saCount, setSaCount] = useState(2);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.ok ? r.json() : null),
      fetch("/api/courses").then(r => r.json()),
      fetch("/api/lessons").then(r => r.json()),
      fetch("/api/user/settings").then(r => r.json()),
    ]).then(([quiz, c, l, s]) => {
      if (!quiz) { setNotFound(true); setLoading(false); return; }
      setQuizTitle(quiz.title ?? "");
      setQuestions(Array.isArray(quiz.questions) ? quiz.questions : []);
      setLessonIds(Array.isArray(quiz.lessonIds) ? quiz.lessonIds : []);
      setCourseId(quiz.courseId ?? "");
      setModuleId(quiz.moduleId ?? "");
      setCourses(Array.isArray(c) ? c : []);
      setAllLessons(Array.isArray(l) ? l : []);
      setHasAiKey(s.hasKey ?? false);
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  // Derived
  const selectedCourse = courses.find(c => c.id === courseId);
  const modules: CourseModule[] = selectedCourse?.modules ?? [];
  const courseLessons = allLessons.filter(l => l.courseId === courseId);
  const selectedLessonIds = new Set(lessonIds);

  function toggleLesson(lid: string) {
    setLessonIds(prev =>
      prev.includes(lid) ? prev.filter(x => x !== lid) : [...prev, lid]
    );
  }

  function buildMergedLesson() {
    const targetLessons = allLessons.filter(l => lessonIds.includes(l.id));
    return {
      title: quizTitle || targetLessons.map(l => l.title).join(", "),
      topics: targetLessons.map(l => l.topics).filter(Boolean).join(", "),
      learningTargets: targetLessons.map(l => l.learningTargets).filter(Boolean).join("\n\n"),
      vocabulary: targetLessons.map(l => l.vocabulary).filter(Boolean).join("\n\n"),
      overview: targetLessons.map(l => l.overview).filter(Boolean).join("\n\n"),
      slideContent: targetLessons.map(l => l.slideContent).filter(Boolean).join("\n\n"),
      guidedLab: targetLessons.map(l => l.guidedLab).filter(Boolean).join("\n\n"),
      industryBestPractices: targetLessons.map(l => l.industryBestPractices).filter(Boolean).join("\n\n"),
      studentLevel: targetLessons[0]?.studentLevel,
    };
  }

  async function handleAiGenerate() {
    setAiGenerating(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson: buildMergedLesson(), mcCount, saCount, courseId: courseId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI generation failed.");
      const stamped = (data as FormQuestion[]).map(q => ({
        ...q,
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      }));
      setQuestions(prev => [...prev, ...stamped]);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleSave() {
    if (!quizTitle.trim()) { setSaveError("Quiz title is required."); return; }
    if (questions.length === 0) { setSaveError("Add at least one question."); return; }
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quizTitle.trim(),
          questions,
          lessonIds,
          ...(courseId ? { courseId } : { courseId: "" }),
          ...(moduleId ? { moduleId } : { moduleId: "" }),
        }),
      });
      if (!res.ok) throw new Error("Failed to save.");
      setSaved(true);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function addQuestion() {
    setQuestions(prev => [...prev, emptyQuestion(`q_${Date.now()}`)]);
  }

  function updateQuestion(qid: string, patch: Partial<FormQuestion>) {
    setQuestions(prev => prev.map(q => q.id === qid ? { ...q, ...patch } : q));
  }

  function removeQuestion(qid: string) {
    setQuestions(prev => prev.filter(q => q.id !== qid));
  }

  function updateOption(qId: string, idx: number, value: string) {
    setQuestions(prev => prev.map(q =>
      q.id === qId ? { ...q, options: q.options.map((o, i) => i === idx ? value : o) } : q
    ));
  }

  function addOption(qId: string) {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: [...q.options, ""] } : q));
  }

  function removeOption(qId: string, idx: number) {
    setQuestions(prev => prev.map(q =>
      q.id === qId && q.options.length > 2 ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q
    ));
  }

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading…</p>;
  if (notFound) return <p className="text-sm text-red-500 mt-10">Quiz not found.</p>;

  const canAiGenerate = hasAiKey && lessonIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.push("/quizzes")} className="text-sm text-[#0cc0df] hover:underline mb-2 block">
          ← Back to Quizzes
        </button>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Edit Quiz</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Update quiz questions and assignment.
        </p>
      </div>

      {/* ── Assignment ── */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Assignment</p>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Course</label>
          <select
            value={courseId}
            onChange={e => { setCourseId(e.target.value); setModuleId(""); setLessonIds([]); }}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— Standalone (no course) —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        {courseId && modules.length > 0 && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Module (optional)</label>
            <select value={moduleId} onChange={e => setModuleId(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">— No module —</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        )}

        {courseId && courseLessons.length > 0 && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lessons</label>
            <div className="space-y-1 max-h-60 overflow-y-auto rounded-2xl p-1" style={{ border: "1px solid var(--border)" }}>
              {courseLessons.map(lesson => (
                <button
                  key={lesson.id}
                  onClick={() => toggleLesson(lesson.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition hover:bg-[var(--bg-card-hover)]"
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${selectedLessonIds.has(lesson.id) ? "bg-[#0cc0df] border-[#0cc0df]" : "border-[var(--border)]"}`}
                    style={selectedLessonIds.has(lesson.id) ? {} : { background: "var(--bg-body)" }}
                  >
                    {selectedLessonIds.has(lesson.id) && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-[#0a0b13]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                    {lesson.subtitle && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{lesson.subtitle}</p>}
                  </div>
                </button>
              ))}
            </div>
            {lessonIds.length > 0 && (
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{lessonIds.length} lesson{lessonIds.length !== 1 ? "s" : ""} selected</p>
            )}
          </div>
        )}
      </div>

      {/* ── Quiz Info ── */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Quiz Info</p>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Quiz Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={quizTitle}
            onChange={e => setQuizTitle(e.target.value)}
            placeholder="e.g. Module 1 Review Quiz"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── AI Generate ── */}
      {hasAiKey && (
        <div className={cardClass} style={cardStyle}>
          <p className={sectionLabel}>AI Generation</p>
          <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>
            AI generates questions from selected lessons and appends them below.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Multiple Choice</label>
              <input type="number" min={0} max={50} value={mcCount} onChange={e => setMcCount(Math.min(50, Math.max(0, Number(e.target.value))))} className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Short Answer</label>
              <input type="number" min={0} max={50} value={saCount} onChange={e => setSaCount(Math.min(50, Math.max(0, Number(e.target.value))))} className={inputClass} style={inputStyle} />
            </div>
          </div>
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating || !canAiGenerate}
            title={!canAiGenerate ? "Select at least one lesson first" : undefined}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {aiGenerating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Generating…
              </span>
            ) : `AI Generate (${mcCount} MC + ${saCount} SA)`}
          </button>
        </div>
      )}

      {/* ── Questions ── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Questions ({questions.length})</p>
          <button
            onClick={addQuestion}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            + Add Question
          </button>
        </div>

        {questions.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
            No questions yet — use AI Generate above or add manually.
          </p>
        ) : (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold mt-1.5 shrink-0" style={{ color: "var(--text-muted)" }}>Q{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={q.text}
                      onChange={e => updateQuestion(q.id, { text: e.target.value })}
                      placeholder="Question text"
                      className={inputClass}
                      style={inputStyle}
                    />
                    <div className="flex items-center gap-3">
                      <select
                        value={q.type}
                        onChange={e => updateQuestion(q.id, { type: e.target.value as FormQuestion["type"] })}
                        className="rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0cc0df]"
                        style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="paragraph">Paragraph</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                        <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} className="accent-[#0cc0df]" />
                        Required
                      </label>
                    </div>
                    {q.type === "multiple_choice" && (
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctAnswer === opt && opt.trim() !== ""}
                              onChange={() => { updateOption(q.id, oi, opt); updateQuestion(q.id, { correctAnswer: opt }); }}
                              className="accent-[#0cc0df] shrink-0"
                              title="Mark as correct answer"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={e => updateOption(q.id, oi, e.target.value)}
                              placeholder={`Option ${oi + 1}`}
                              className={`flex-1 ${inputClass}`}
                              style={inputStyle}
                            />
                            {q.options.length > 2 && (
                              <button onClick={() => removeOption(q.id, oi)} className="text-xs hover:text-red-500 transition shrink-0" style={{ color: "var(--text-muted)" }}>×</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addOption(q.id)} className="text-xs hover:underline" style={{ color: "#0cc0df" }}>
                          + Add option
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="p-1 rounded-full transition hover:text-red-500 hover:bg-red-500/10 shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Save ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !quizTitle.trim() || questions.length === 0}
          className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        {saved && <p className="text-xs font-semibold text-[#2dd4a0]">Changes saved!</p>}
      </div>
    </div>
  );
}
