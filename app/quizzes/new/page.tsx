"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Course, CourseModule } from "@/types/course";
import type { Lesson } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { emptyQuestion } from "@/types/form";
import { getSectionContent } from "@/lib/sections";
import { clearDraft } from "@/lib/draftStorage";
import { useDraftAutosave, useDraftRestore } from "@/hooks/useDraftAutosave";
import { parsePastedQuestions } from "@/lib/parseQuestions";

type Scope = "lesson" | "module" | "course" | "standalone";

const SCOPE_OPTIONS: { value: Scope; label: string; description: string }[] = [
  { value: "lesson",     label: "Lesson(s)",    description: "Select one or more lessons" },
  { value: "module",     label: "Module",       description: "All lessons in a module" },
  { value: "course",     label: "Whole Course", description: "All lessons in a course" },
  { value: "standalone", label: "Standalone",   description: "Not linked to any lesson" },
];

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

// savedDraftId is included (not just form fields) — if a real quiz-draft doc already exists
// from an earlier manual "Save Quiz Draft" click, restoring it is what makes the next save
// PUT to that same doc instead of accidentally creating a duplicate.
interface QuizNewDraft {
  scope: Scope;
  selectedCourseId: string;
  selectedModuleId: string;
  selectedLessonIds: string[];
  quizTitle: string;
  questions: FormQuestion[];
  mcCount: number;
  saCount: number;
  savedDraftId: string;
}

function NewQuizPageInner() {
  useSession({ required: true });
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId") ?? "";

  // Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [hasAiKey, setHasAiKey] = useState(false);

  // Scope
  const [scope, setScope] = useState<Scope>("lesson");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());

  // Quiz content
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [mcCount, setMcCount] = useState(8);
  const [saCount, setSaCount] = useState(2);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  // Status
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedDraftId, setSavedDraftId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

  const draftKey = "quiz:new";
  // Restore only after the initial courses/lessons fetch lands — when arriving via ?courseId=,
  // that fetch's .then() forces scope/selectedCourseId/quizTitle and would otherwise overwrite
  // a just-restored draft.
  useDraftRestore<QuizNewDraft>(dataLoaded ? draftKey : null, (draft) => {
    setScope(draft.scope);
    setSelectedCourseId(draft.selectedCourseId);
    setSelectedModuleId(draft.selectedModuleId);
    setSelectedLessonIds(new Set(draft.selectedLessonIds));
    setQuizTitle(draft.quizTitle);
    setQuestions(draft.questions);
    setMcCount(draft.mcCount);
    setSaCount(draft.saCount);
    setSavedDraftId(draft.savedDraftId);
  });
  useDraftAutosave<QuizNewDraft>(draftKey, {
    scope, selectedCourseId, selectedModuleId,
    selectedLessonIds: Array.from(selectedLessonIds),
    quizTitle, questions, mcCount, saCount, savedDraftId,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/courses").then(r => r.json()),
      fetch("/api/lessons").then(r => r.json()),
      fetch("/api/user/settings").then(r => r.json()),
    ]).then(([c, l, s]) => {
      setCourses(Array.isArray(c) ? c : []);
      setAllLessons(Array.isArray(l) ? l : []);
      setHasAiKey(s.hasKey ?? false);
      if (preselectedCourseId) {
        const course = (Array.isArray(c) ? c : []).find((x: { id: string; title: string }) => x.id === preselectedCourseId);
        setScope("course");
        setSelectedCourseId(preselectedCourseId);
        if (course) setQuizTitle(`${course.title} — Final Quiz`);
      }
    }).catch(() => {}).finally(() => setDataLoaded(true));
  }, []);

  // Derived
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const modules: CourseModule[] = selectedCourse?.modules ?? [];
  const selectedModule = modules.find(m => m.id === selectedModuleId);
  const courseLessons = allLessons.filter(l => l.courseId === selectedCourseId);

  const resolvedLessonIds: string[] = (() => {
    if (scope === "standalone") return [];
    if (scope === "course") return courseLessons.map(l => l.id);
    if (scope === "module") return selectedModule?.lessonIds ?? [];
    return [...selectedLessonIds];
  })();

  function handleScopeChange(s: Scope) {
    setScope(s);
    // Course selection persists across scope changes — every scope requires one, so there's
    // no reason to make someone re-pick it. Only the scope-specific selections reset.
    setSelectedModuleId("");
    setSelectedLessonIds(new Set());
    setQuizTitle("");
  }

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedModuleId("");
    setSelectedLessonIds(new Set());
    const course = courses.find(c => c.id === courseId);
    if (course && scope === "course") setQuizTitle(`${course.title} — Final Quiz`);
  }

  function handleModuleChange(moduleId: string) {
    setSelectedModuleId(moduleId);
    setSelectedLessonIds(new Set());
    const mod = modules.find(m => m.id === moduleId);
    if (mod) setQuizTitle(`${mod.title} — Quiz`);
  }

  function toggleLesson(id: string) {
    setSelectedLessonIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (scope === "lesson" && !quizTitle.trim()) {
        const names = allLessons.filter(l => next.has(l.id)).map(l => l.title);
        if (names.length > 0) setQuizTitle(names.join(", ") + " — Quiz");
      }
      return next;
    });
  }

  function buildMergedLesson() {
    const targetLessons = scope === "standalone"
      ? []
      : allLessons.filter(l => resolvedLessonIds.includes(l.id));
    // Read via getSectionContent(), not the legacy field directly — a lesson edited through
    // the new dynamic-sections LessonForm has its real content in `sections`, and the flat
    // field would be stale/blank for it.
    return {
      title: quizTitle || targetLessons.map(l => l.title).join(", "),
      topics: targetLessons.map(l => l.topics).filter(Boolean).join(", "),
      learningTargets: targetLessons.map(l => getSectionContent(l, "learningTargets")).filter(Boolean).join("\n\n"),
      vocabulary: targetLessons.map(l => getSectionContent(l, "vocabulary")).filter(Boolean).join("\n\n"),
      overview: targetLessons.map(l => getSectionContent(l, "lessonOverview")).filter(Boolean).join("\n\n"),
      slideContent: targetLessons.map(l => l.slideContent).filter(Boolean).join("\n\n"),
      guidedLab: targetLessons.map(l => getSectionContent(l, "guidedLab")).filter(Boolean).join("\n\n"),
      industryBestPractices: targetLessons.map(l => getSectionContent(l, "industryBestPractices")).filter(Boolean).join("\n\n"),
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
        body: JSON.stringify({ lesson: buildMergedLesson(), mcCount, saCount, courseId: selectedCourseId || undefined }),
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

  /** Creates the draft on first save, updates it in place on every subsequent save. */
  async function saveDraft(): Promise<string> {
    const payload = {
      title: quizTitle.trim(),
      lessonIds: resolvedLessonIds,
      moduleId: selectedModuleId || undefined,
      courseId: selectedCourseId || undefined,
      questions,
    };
    const res = savedDraftId
      ? await fetch(`/api/projects/${savedDraftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save quiz draft.");
    const id: string = data.id ?? savedDraftId;
    setSavedDraftId(id);
    clearDraft(draftKey);
    return id;
  }

  async function handleSaveDraft() {
    if (!quizTitle.trim()) { setSaveError("Quiz title is required."); return; }
    if (questions.length === 0) { setSaveError("Add at least one question."); return; }
    if (!selectedCourseId) { setSaveError("Course is required."); return; }
    setSaving(true);
    setSaveError("");
    try {
      await saveDraft();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateForm() {
    if (!quizTitle.trim()) { setSaveError("Quiz title is required."); return; }
    if (questions.length === 0) { setSaveError("Add at least one question."); return; }
    if (!selectedCourseId) { setSaveError("Course is required."); return; }
    setGenerating(true);
    setSaveError("");
    setGenerateError("");
    const isNewDraft = !savedDraftId;
    let draftId: string;
    try {
      // Always (re-)save first so the form is generated from the latest edits, not a stale draft.
      draftId = await saveDraft();
    } catch (err: any) {
      setGenerateError(err.message);
      setGenerating(false);
      return;
    }
    try {
      const genRes = await fetch(`/api/generate/quiz/${draftId}`, { method: "POST" });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || "Generation failed.");
      router.push(`/quizzes/${draftId}`);
    } catch (err: any) {
      setGenerateError(err.message);
      // Clean up the draft we just created — it has no Google Form and would be a dead entry
      if (isNewDraft && draftId) {
        fetch(`/api/projects/${draftId}`, { method: "DELETE" }).catch(() => {});
        setSavedDraftId("");
      }
      setGenerating(false);
    }
  }

  function addQuestion() {
    setQuestions(prev => [...prev, emptyQuestion(`q_${Date.now()}`)]);
  }

  function importQuestions(parsed: FormQuestion[]) {
    setQuestions(prev => [...prev, ...parsed]);
  }

  function updateQuestion(id: string, patch: Partial<FormQuestion>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id));
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

  const canAiGenerate = hasAiKey && (scope === "standalone" || resolvedLessonIds.length > 0 || selectedLessonIds.size > 0);
  const needsModule = (scope === "lesson" || scope === "module") && modules.length > 0;
  const canSave = quizTitle.trim() && questions.length > 0 && !!selectedCourseId && (!needsModule || !!selectedModuleId);
  const importPreview = importText.trim() ? parsePastedQuestions(importText) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.push("/quizzes")} className="text-sm text-[#0cc0df] hover:underline mb-2 block">
          ← Back to Quizzes
        </button>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>New Quiz</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Build a quiz linked to one or more lessons, a module, or a whole course.
        </p>
      </div>

      {/* ── Scope ── */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Scope</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SCOPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleScopeChange(opt.value)}
              className="flex flex-col items-start p-3 rounded-2xl text-left transition"
              style={scope === opt.value
                ? { background: "var(--accent-bg)", border: "2px solid #0cc0df", color: "var(--text-primary)" }
                : { background: "var(--bg-card-hover)", border: "2px solid transparent", color: "var(--text-secondary)" }
              }
            >
              <span className="text-xs font-semibold" style={scope === opt.value ? { color: "#0cc0df" } : {}}>{opt.label}</span>
              <span className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Selection ── */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>
          {scope === "lesson" ? "Select Lessons" : scope === "module" ? "Select Module" : "Select Course"}
        </p>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Course <span className="text-red-500">*</span>
          </label>
          <select value={selectedCourseId} onChange={e => handleCourseChange(e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">— Select a course —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          {scope === "standalone" && (
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Not linked to a specific lesson, but every quiz still belongs to a course.
            </p>
          )}
        </div>

        {scope === "module" && selectedCourseId && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Module</label>
            {modules.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>This course has no modules yet.</p>
            ) : (
              <select value={selectedModuleId} onChange={e => handleModuleChange(e.target.value)} className={inputClass} style={inputStyle}>
                <option value="">— Select a module —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title} ({m.lessonIds.length} lessons)</option>)}
              </select>
            )}
          </div>
        )}

        {scope === "lesson" && selectedCourseId && modules.length > 0 && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Module <span className="text-red-500">*</span></label>
            <select value={selectedModuleId} onChange={e => setSelectedModuleId(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">— Select a module —</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        )}

        {scope === "lesson" && selectedCourseId && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lessons</label>
            {courseLessons.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No lessons in this course.</p>
            ) : (
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
            )}
            {selectedLessonIds.size > 0 && (
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{selectedLessonIds.size} lesson{selectedLessonIds.size !== 1 ? "s" : ""} selected</p>
            )}
          </div>
        )}

        {scope === "course" && selectedCourseId && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {courseLessons.length} lesson{courseLessons.length !== 1 ? "s" : ""} in this course will be used for AI generation.
          </p>
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
            AI generates questions from the selected lesson content and appends them to your list below.
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(v => !v)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {showImport ? "Cancel Import" : "Import Questions"}
            </button>
            <button
              onClick={addQuestion}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              + Add Question
            </button>
          </div>
        </div>

        {showImport && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Paste questions, one per blank line (or numbered &lsquo;1.&rsquo;, &lsquo;2.&rsquo;...). Lines starting with &lsquo;a)&rsquo;, &lsquo;-&rsquo;, or &lsquo;*&rsquo; become
              multiple-choice options — mark the correct one with a trailing *. Questions with no options become short-answer.
            </p>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={8}
              placeholder={"What is the capital of France?\na) London\nb) Paris*\nc) Berlin\nd) Madrid\n\nExplain the water cycle in your own words."}
              className={`${inputClass} font-mono`}
              style={inputStyle}
            />
            {importText.trim() && (
              <p className="text-[10px]" style={{ color: importPreview.length > 0 ? "#2dd4a0" : "#ef4444" }}>
                {importPreview.length > 0
                  ? `${importPreview.length} question${importPreview.length !== 1 ? "s" : ""} detected`
                  : "No questions detected — check the format above."}
              </p>
            )}
            <button
              onClick={() => { importQuestions(importPreview); setImportText(""); setShowImport(false); }}
              disabled={importPreview.length === 0}
              className="rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-40"
              style={{ background: "#0cc0df", color: "#0a0b13" }}
            >
              Add {importPreview.length || ""} Question{importPreview.length !== 1 ? "s" : ""}
            </button>
          </div>
        )}

        {questions.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
            No questions yet — use AI Generate above, add manually, or import from pasted text.
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

      {/* ── Save / Generate ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSaveDraft}
            disabled={saving || generating || !canSave}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
          >
            {saving ? "Saving…" : "Save Quiz Draft"}
          </button>
          <button
            onClick={handleGenerateForm}
            disabled={generating || saving || !canSave}
            className="rounded-full px-6 py-2.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50 shadow"
            style={{ background: "#0cc0df", color: "#0a0b13" }}
          >
            {generating ? "Generating…" : "Generate Google Form"}
          </button>
          {savedDraftId && !generating && (
            <p className="text-xs font-semibold text-[#2dd4a0]">
              Draft saved!{" "}
              <button onClick={() => router.push("/quizzes")} className="underline">View all quizzes</button>
            </p>
          )}
        </div>
        {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        {generateError && <p className="text-xs text-red-500">{generateError}</p>}
      </div>
    </div>
  );
}

export default function NewQuizPage() {
  return (
    <Suspense>
      <NewQuizPageInner />
    </Suspense>
  );
}
