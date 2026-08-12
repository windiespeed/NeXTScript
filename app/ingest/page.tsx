"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import SlideRenderer from "@/components/slides/SlideRenderer";
import SlideEditorPanel from "@/components/slides/SlideEditorPanel";
import ThemePicker from "@/components/ThemePicker";
import { DEFAULT_THEME_ID, getTheme } from "@/lib/themes";
import { STUDENT_LEVEL_UI_HINTS, type StudentLevel } from "@/lib/studentLevel";
import type { PresentationAST } from "@/types/slideAst";
import type { Course, CourseModule } from "@/types/course";
import type { Lesson, LessonInput } from "@/types/lesson";
import type { SectionDef } from "@/types/section";
import { resolveSections } from "@/lib/sections";
import { clearDraft } from "@/lib/draftStorage";
import { useDraftAutosave, useDraftRestore } from "@/hooks/useDraftAutosave";

const inputClass = "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardClass = "rounded-3xl p-6 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

const SPINNER = (
  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

// Every other required LessonInput field defaults quietly — Notes to Slides only surfaces the
// same "Lesson Info" fields LessonForm does, matching its own EMPTY defaults for the rest.
const EMPTY_LESSON_DEFAULTS: LessonInput = {
  title: "", subtitle: "", topics: "", deadline: "", tag: "", notes: "",
  overview: "", learningTargets: "", vocabulary: "", warmUp: "", slideContent: "",
  guidedLab: "", selfPaced: "", submissionChecklist: "", checkpoint: "",
  industryBestPractices: "", devJournalPrompt: "", rubric: "", sources: "",
  studentLevel: "beginner", sections: {},
};

type LessonType = NonNullable<LessonInput["lessonType"]>;

// Whitelist of fields worth restoring after a refresh. Deliberately excludes every
// transient/in-flight flag (generating, saving, exporting, progress, error, etc.) so a
// restore always lands in a stable "ready to act" state, never a phantom mid-run one.
interface IngestDraft {
  selectedCourseId: string;
  selectedModuleId: string;
  selectedExistingLessonId: string;
  title: string;
  subtitle: string;
  topics: string;
  deadline: string;
  lessonType: LessonType;
  sources: string;
  studentLevel: StudentLevel;
  requiredTopicsText: string;
  rawText: string;
  targetAudience: string;
  slideCount: string;
  ast: PresentationAST | null;
  activeIndex: number;
  viewMode: "preview" | "edit";
  selectedThemeId: string;
}

function IngestPageInner() {
  useSession({ required: true });
  const searchParams = useSearchParams();
  const lessonIdParam = searchParams.get("lessonId") ?? "";

  const [hasAiKey, setHasAiKey] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Assignment (mirrors app/slides/new/page.tsx)
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Attach to an existing lesson instead of creating a new one — either deep-linked via
  // ?lessonId= (from a lesson's own hub page, locked) or picked from the dropdown below.
  const [existingLessonId, setExistingLessonId] = useState<string | null>(null);
  const [attachedLessonTitle, setAttachedLessonTitle] = useState("");
  const [lockedFromQuery, setLockedFromQuery] = useState(false);
  const [courseLessons, setCourseLessons] = useState<Lesson[]>([]);
  const [selectedExistingLessonId, setSelectedExistingLessonId] = useState("");

  // Lesson info (mirrors LessonForm's "Lesson Info" section)
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [topics, setTopics] = useState("");
  const [deadline, setDeadline] = useState("");
  const [lessonType, setLessonType] = useState<LessonType>("lesson");
  const [sources, setSources] = useState("");
  const [studentLevel, setStudentLevel] = useState<StudentLevel>("beginner");
  const [userDefaultSources, setUserDefaultSources] = useState("");
  const [userSectionSettings, setUserSectionSettings] = useState<{ sectionLabels?: Record<string, string>; sections?: SectionDef[] }>({});

  // Course defaults pulled in once a course is picked — user can verify/adjust before generating
  const [requiredTopicsText, setRequiredTopicsText] = useState("");

  // Raw content
  const [rawText, setRawText] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [slideCount, setSlideCount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [ast, setAst] = useState<PresentationAST | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [selectedThemeId, setSelectedThemeId] = useState(DEFAULT_THEME_ID);
  const theme = getTheme(selectedThemeId);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedJustNow, setSavedJustNow] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  // Keyed by whichever lesson this generation is (or will be) attached to — once ensureLesson()
  // resolves a real id, the draft moves under that id so it stays tied to the right lesson.
  const draftKey = `ingest:${existingLessonId || lessonId || lessonIdParam || "new"}`;
  // Restore only after the initial settings/courses fetch (and, if deep-linked, the lesson
  // fetch) has landed — otherwise those async .then() callbacks resolve after restore and
  // silently overwrite the just-restored fields with server defaults.
  useDraftRestore<IngestDraft>(settingsLoaded && (!lessonIdParam || existingLessonId) ? draftKey : null, (draft) => {
    setSelectedCourseId(draft.selectedCourseId);
    setSelectedModuleId(draft.selectedModuleId);
    setSelectedExistingLessonId(draft.selectedExistingLessonId);
    setTitle(draft.title);
    setSubtitle(draft.subtitle);
    setTopics(draft.topics);
    setDeadline(draft.deadline);
    setLessonType(draft.lessonType);
    setSources(draft.sources);
    setStudentLevel(draft.studentLevel);
    setRequiredTopicsText(draft.requiredTopicsText);
    setRawText(draft.rawText);
    setTargetAudience(draft.targetAudience);
    setSlideCount(draft.slideCount);
    setAst(draft.ast);
    setActiveIndex(draft.activeIndex);
    setViewMode(draft.viewMode);
    setSelectedThemeId(draft.selectedThemeId);
  });
  useDraftAutosave<IngestDraft>(draftKey, {
    selectedCourseId, selectedModuleId, selectedExistingLessonId,
    title, subtitle, topics, deadline, lessonType, sources, studentLevel,
    requiredTopicsText, rawText, targetAudience, slideCount,
    ast, activeIndex, viewMode, selectedThemeId,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/user/settings").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]).then(([settings, coursesData]) => {
      setHasAiKey(settings.hasKey ?? false);
      setUserDefaultSources(settings.defaultSources ?? "");
      setSources(settings.defaultSources ?? "");
      setUserSectionSettings({ sectionLabels: settings.sectionLabels, sections: settings.sections });
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);

  // Update modules + pull course defaults whenever the selected course changes
  useEffect(() => {
    const course = courses.find(c => c.id === selectedCourseId);
    setModules(Array.isArray(course?.modules) ? course!.modules : []);
    setSelectedModuleId("");
    // Explicit "Required Slide Topics" wins; otherwise default to the course's active section
    // list so every deck covers the standard curriculum sections without extra configuration.
    const explicitTopics = course?.settings?.requiredSlideTopics?.trim();
    const sectionTopics = resolveSections({ course, userSettings: userSectionSettings }).map(s => s.label).filter(Boolean).join("\n");
    setRequiredTopicsText(explicitTopics || sectionTopics);
    setSources(course?.settings?.defaultSources || userDefaultSources);
    setSelectedThemeId(course?.settings?.defaultThemeId || DEFAULT_THEME_ID);
  }, [selectedCourseId, courses, userDefaultSources, userSectionSettings]);

  // Deep-link: ?lessonId= arrives from an existing lesson's own hub page — pre-fill
  // everything from that lesson and lock the attachment so it can't be picked away by accident.
  useEffect(() => {
    if (!lessonIdParam) return;
    fetch(`/api/lessons/${lessonIdParam}`).then(r => r.ok ? r.json() : null).then((lesson: Lesson | null) => {
      if (!lesson) return;
      setExistingLessonId(lesson.id);
      setSelectedExistingLessonId(lesson.id);
      setAttachedLessonTitle(lesson.title);
      setLockedFromQuery(true);
      setSelectedCourseId(lesson.courseId ?? "");
      setTitle(lesson.title);
      setSubtitle(lesson.subtitle ?? "");
      setTopics(lesson.topics ?? "");
      setDeadline(lesson.deadline ?? "");
      setLessonType((lesson.lessonType as LessonType) ?? "lesson");
      if (lesson.sources) setSources(lesson.sources);
      setStudentLevel(lesson.studentLevel ?? "beginner");
    }).catch(() => {});
  }, [lessonIdParam]);

  // Populate the "attach to existing lesson" picker with this course's lessons
  useEffect(() => {
    if (!selectedCourseId) { setCourseLessons([]); return; }
    fetch(`/api/lessons?courseId=${selectedCourseId}`).then(r => r.json()).then(data => {
      setCourseLessons(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [selectedCourseId]);

  function handlePickExistingLesson(id: string) {
    setSelectedExistingLessonId(id);
    if (!id) { setExistingLessonId(null); return; }
    const lesson = courseLessons.find(l => l.id === id);
    if (!lesson) return;
    setExistingLessonId(lesson.id);
    setTitle(lesson.title);
    setSubtitle(lesson.subtitle ?? "");
    setTopics(lesson.topics ?? "");
    setDeadline(lesson.deadline ?? "");
    setLessonType((lesson.lessonType as LessonType) ?? "lesson");
    if (lesson.sources) setSources(lesson.sources);
    setStudentLevel(lesson.studentLevel ?? "beginner");
  }

  function handleDetachLesson() {
    setExistingLessonId(null);
    setSelectedExistingLessonId("");
    setLockedFromQuery(false);
    setAttachedLessonTitle("");
  }

  // Stop the fake progress animation if the page is left mid-generation
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // Left/right arrow navigation once a deck is generated (preview mode only)
  useEffect(() => {
    if (!ast || viewMode !== "preview") return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setActiveIndex(i => Math.min(i + 1, ast!.slides.length - 1));
      if (e.key === "ArrowLeft") setActiveIndex(i => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [ast, viewMode]);

  // There's no real progress signal from a single non-streaming AI call, so this animates
  // toward (but never quite reaches) 92% — fast at first, slowing to a crawl — and snaps to
  // 100% once the response actually lands. It's an estimate, not a token-level readout.
  function startProgressAnimation() {
    setProgress(4);
    progressTimerRef.current = setInterval(() => {
      setProgress(p => (p >= 92 ? p : p + (92 - p) * 0.035));
    }, 150);
  }

  function stopProgressAnimation(finalValue: number) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(finalValue);
  }

  /** Creates (or reuses an attached) lesson this generation will be saved onto — once per session, reused on regenerate. */
  async function ensureLesson(): Promise<string> {
    if (lessonId) return lessonId;

    let newLessonId: string;
    if (existingLessonId) {
      // Attached to an existing lesson — update it in place with whatever's in Lesson Info
      // rather than creating a duplicate.
      const res = await fetch(`/api/lessons/${existingLessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim(),
          topics: topics.trim(),
          deadline,
          lessonType,
          sources,
          studentLevel,
          courseId: selectedCourseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update the lesson.");
      newLessonId = existingLessonId;
    } else {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...EMPTY_LESSON_DEFAULTS,
          title: title.trim(),
          subtitle: subtitle.trim(),
          topics: topics.trim(),
          deadline,
          lessonType,
          sources,
          studentLevel,
          courseId: selectedCourseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create the lesson.");
      newLessonId = data.id as string;
    }
    setLessonId(newLessonId);

    if (selectedCourseId && selectedModuleId && selectedCourse) {
      const updatedModules = (selectedCourse.modules ?? []).map(m => ({
        ...m,
        lessonIds: m.id === selectedModuleId
          ? (m.lessonIds.includes(newLessonId) ? m.lessonIds : [...m.lessonIds, newLessonId])
          : m.lessonIds,
      }));
      await fetch(`/api/courses/${selectedCourseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: updatedModules }),
      }).catch(() => {});
    }

    return newLessonId;
  }

  async function handleGenerate() {
    if (!rawText.trim() || !title.trim() || !selectedCourseId || generating) return;
    setGenerating(true);
    setError(null);
    startProgressAnimation();
    try {
      await ensureLesson();
      const requiredTopics = requiredTopicsText.split("\n").map(s => s.trim()).filter(Boolean);
      const res = await fetch("/api/ai/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          targetAudience: targetAudience.trim() || undefined,
          slideCount: slideCount ? Number(slideCount) : undefined,
          requiredTopics: requiredTopics.length > 0 ? requiredTopics : undefined,
          studentLevel,
          lessonTitle: title.trim() || undefined,
          lessonSubtitle: subtitle.trim() || undefined,
          topics: topics.trim() || undefined,
          sources: sources.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate slides.");
      stopProgressAnimation(100);
      setAst(data as PresentationAST);
      setActiveIndex(0);
      setViewMode("preview");
    } catch (err) {
      stopProgressAnimation(0);
      setError(err instanceof Error ? err.message : "Failed to generate slides.");
    } finally {
      setGenerating(false);
    }
  }

  function handleClearLessonInfo() {
    setTitle("");
    setSubtitle("");
    setTopics("");
    setDeadline("");
    setLessonType("lesson");
    setSources("");
    setStudentLevel("beginner");
  }

  function handleStartOver() {
    setAst(null);
    setActiveIndex(0);
    setError(null);
    setExportedUrl(null);
    setExportError(null);
    setSaveError(null);
    setLessonId(null);
    setViewMode("preview");
  }

  async function handleSave() {
    if (!ast || !lessonId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentationAST: ast, selectedTheme: selectedThemeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save to the lesson.");
      clearDraft(draftKey);
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save to the lesson.");
    } finally {
      setSaving(false);
    }
  }

  /** Toggling out of Edit mode persists automatically, per "saves or closes the editor". */
  async function handleToggleMode() {
    if (viewMode === "edit") await handleSave();
    setViewMode(viewMode === "edit" ? "preview" : "edit");
  }

  async function handleExport() {
    if (!ast || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/ai/ingest/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ast, lessonId: lessonId ?? undefined, courseId: selectedCourseId || undefined, themeId: selectedThemeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create the Google Slides deck.");
      setExportedUrl(data.url as string);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to create the Google Slides deck.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Content</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Notes to Slides</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Paste rough notes or a brain-dump and get an instantly-rendered, presentation-ready slide deck.
        </p>
      </div>

      {settingsLoaded && !hasAiKey ? (
        <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No Anthropic API key configured</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Add your key to use AI ingestion.</p>
          <Link
            href="/profile"
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Add API key in Profile
          </Link>
        </div>
      ) : !ast ? (
        <div className="space-y-4">
          {/* ── Assignment ── */}
          <div className={cardClass} style={cardStyle}>
            <p className={sectionLabel}>Assignment</p>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Course <span className="text-red-500">*</span>
              </label>
              <select required disabled={lockedFromQuery} value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className={inputClass} style={inputStyle}>
                <option value="">— Select a course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            {selectedCourseId && modules.length > 0 && !lockedFromQuery && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Module <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <select value={selectedModuleId} onChange={e => setSelectedModuleId(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">— No module —</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            )}
            {lockedFromQuery ? (
              <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "var(--accent-purple-bg)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--accent-purple)" }}>
                  Attached to lesson: {attachedLessonTitle}
                </p>
                <button type="button" onClick={handleDetachLesson} className="text-[10px] font-semibold shrink-0 hover:underline" style={{ color: "var(--accent-purple)" }}>
                  Detach
                </button>
              </div>
            ) : selectedCourseId && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Attach to Lesson <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <select value={selectedExistingLessonId} onChange={e => handlePickExistingLesson(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">— Create new lesson —</option>
                  {courseLessons.map(l => <option key={l.id} value={l.id}>{l.title}{l.subtitle ? ` — ${l.subtitle}` : ""}</option>)}
                </select>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {selectedExistingLessonId
                    ? "Generating will replace this lesson's Lesson Info with what's below and add the deck to its Documents."
                    : "Leave as-is to create a new lesson, or pick an existing one to generate a deck for it instead."}
                </p>
              </div>
            )}
          </div>

          {/* ── Lesson Info (mirrors LessonForm's "Lesson Info" card on /slides/new) ── */}
          <div className={cardClass} style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className={sectionLabel}>Lesson Info</p>
              <button
                type="button"
                onClick={handleClearLessonInfo}
                className="text-[10px] font-semibold rounded-full px-2 py-0.5 transition hover:bg-red-500/10 hover:text-red-500"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Clear
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Lesson Title <span className="text-red-500">*</span> {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "#0cc0df" }}>· used by AI</span>}
              </label>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Module number and lesson number (e.g. Module 3, Lesson 2)</p>
              <input
                required
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Module 3, Lesson 2"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Lesson Subtitle {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "#0cc0df" }}>· used by AI</span>}
              </label>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Specific topic or subject covered in this lesson</p>
              <input
                type="text"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                placeholder="e.g. Introduction to CSS Flexbox"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Topics {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "#0cc0df" }}>· used by AI</span>}
              </label>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Comma-separated. Extra context passed to Notes to Slides alongside your raw notes.</p>
              <input
                type="text"
                value={topics}
                onChange={e => setTopics(e.target.value)}
                placeholder="e.g. Flexbox, CSS Layout"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline</label>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>The due date for this lesson&apos;s assignments.</p>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className={`${inputClass} ${deadline ? "" : "text-[var(--text-muted)]"}`}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Type</label>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Classify the type of activity for this lesson.</p>
                <select
                  value={lessonType}
                  onChange={e => setLessonType(e.target.value as LessonType)}
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
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Sources {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "#0cc0df" }}>· used by AI</span>}
              </label>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                One URL per line. Saved with the lesson as reference material for other AI-fill features.
                {sources
                  ? " Pre-filled from your default sources — add, remove, or edit as needed for this lesson."
                  : " No sources set — add URLs or configure defaults in your Profile settings."}
              </p>
              <textarea
                value={sources}
                onChange={e => setSources(e.target.value)}
                rows={4}
                placeholder={"https://www.w3.org/\nhttps://www.w3schools.com/\nhttps://www.wcag.com/"}
                className={`${inputClass} font-mono`}
                style={inputStyle}
              />
            </div>

            {hasAiKey && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Student Level <span className="font-normal text-[10px]" style={{ color: "#0cc0df" }}>· used by AI</span>
                </label>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                  Adjusts the tone and complexity of AI-generated content to match your students&apos; experience.
                </p>
                <div className="flex gap-3">
                  {(["beginner", "intermediate", "advanced"] as const).map(level => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="studentLevel"
                        value={level}
                        checked={studentLevel === level}
                        onChange={() => setStudentLevel(level)}
                        className="accent-[#0cc0df]"
                      />
                      <span className="text-xs capitalize" style={{ color: "var(--text-primary)" }}>{level}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{STUDENT_LEVEL_UI_HINTS[studentLevel]}</p>
              </div>
            )}
          </div>

          {/* ── Course Defaults (only once a course is selected) ── */}
          {selectedCourse && (
            <div className={cardClass} style={cardStyle}>
              <p className={sectionLabel}>Course Defaults</p>
              <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>
                Pulled from {selectedCourse.title}&apos;s settings — review or adjust for this generation only.
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Slides Template</label>
                <p className="text-xs" style={{ color: selectedCourse.settings?.defaultTemplateUrl ? "var(--text-secondary)" : "var(--text-muted)" }}>
                  {selectedCourse.settings?.defaultTemplateUrl || "No template set — export will create a blank deck."}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Required Slide Topics</label>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Notes to Slides guarantees a slide for each of these. One per line. Defaults to this
                  course&apos;s Section Labels unless a custom list is set in Course Settings.
                </p>
                <textarea
                  value={requiredTopicsText}
                  onChange={e => setRequiredTopicsText(e.target.value)}
                  rows={3}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* ── Your Notes ── */}
          <div className={cardClass} style={cardStyle}>
            <p className={sectionLabel}>Your Notes</p>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Notes, brain-dump, or loose bullet points <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={12}
                placeholder={"e.g.\n- explain the core concept\n- compare two approaches or viewpoints\n- steps to complete the process"}
                className={inputClass}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Target Audience <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                  Only needed if Student Level above isn&apos;t specific enough — e.g. a grade level or prior-course context.
                </p>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="e.g. 9th graders who just finished Intro to Python"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Approx. Slide Count <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={slideCount}
                  onChange={e => setSlideCount(e.target.value)}
                  placeholder="Let AI decide"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || !rawText.trim() || !title.trim() || !selectedCourseId}
                title={!selectedCourseId ? "Select a course first" : !title.trim() ? "Add a lesson title first" : undefined}
                className="shrink-0 rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    {SPINNER}
                    Generating slides…
                  </span>
                ) : "Generate Slides"}
              </button>

              {generating && (
                <div
                  className="flex-1 max-w-xs flex items-center gap-2"
                  title="Estimated progress — actual time depends on content length"
                >
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] transition-[width] duration-150 ease-out"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold tabular-nums w-8 text-right shrink-0" style={{ color: "var(--text-muted)" }}>
                    {Math.round(progress)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Deck header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{ast.lessonTitle}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                For {ast.targetAudience} · {ast.slides.length} slide{ast.slides.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {exportedUrl && (
                <a
                  href={exportedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:underline"
                  style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
                >
                  Open in Google Slides ↗
                </a>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="rounded-full bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
              >
                {exporting ? (
                  <span className="flex items-center gap-2">
                    {SPINNER}
                    Creating deck…
                  </span>
                ) : exportedUrl ? "Regenerate Google Slides Deck" : "Export to Google Slides"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {saving ? "Saving…" : savedJustNow ? "Saved ✓" : "Save to Lesson"}
              </button>
              <button
                onClick={handleToggleMode}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: viewMode === "edit" ? "var(--accent)" : "var(--bg-card-hover)", color: viewMode === "edit" ? "#0a0b13" : "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {viewMode === "edit" ? "Done Editing" : "Edit Slides"}
              </button>
              <button
                onClick={handleStartOver}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                ← Start Over
              </button>
            </div>
          </div>

          <ThemePicker value={selectedThemeId} onChange={setSelectedThemeId} />

          {exportError && <p className="text-xs text-red-500">{exportError}</p>}
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}

          {viewMode === "edit" ? (
            <SlideEditorPanel ast={ast} activeIndex={activeIndex} onChange={setAst} onActiveIndexChange={setActiveIndex} />
          ) : (
            <>
              {/* Active slide */}
              <div className="min-h-[420px]" style={{ background: theme.background.page, borderRadius: theme.radius }}>
                <SlideRenderer slide={ast.slides[activeIndex]} theme={theme} />
              </div>

              {/* Navigator */}
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setActiveIndex(i => Math.max(i - 1, 0))}
                  disabled={activeIndex === 0}
                  className="rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-40"
                  style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  ← Prev
                </button>

                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {ast.slides.map((slide, i) => (
                    <button
                      key={slide.id}
                      onClick={() => setActiveIndex(i)}
                      title={slide.title}
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: i === activeIndex ? "1.5rem" : "0.5rem",
                        background: i === activeIndex ? "var(--accent)" : "var(--border)",
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setActiveIndex(i => Math.min(i + 1, ast.slides.length - 1))}
                  disabled={activeIndex === ast.slides.length - 1}
                  className="rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-40"
                  style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function IngestPage() {
  return (
    <Suspense>
      <IngestPageInner />
    </Suspense>
  );
}
