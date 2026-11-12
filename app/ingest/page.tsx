"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import SlideEditorPanel from "@/components/slides/SlideEditorPanel";
import { THEMES, getTheme } from "@/lib/themes";
import AiModelNote from "@/components/AiModelNote";
import type { SavedKeys } from "@/lib/aiModels";
import type { PresentationAST } from "@/types/slideAst";
import type { ThemeConfig } from "@/types/theme";
import SlideCanvas from "@/components/deck/SlideCanvas";
import { astToDeck, deckSlidesFor } from "@/lib/deck/fromAst";
import { layoutSlide } from "@/lib/deck/layout/registry";
import type { Course, CourseModule } from "@/types/course";
import type { Lesson, LessonInput } from "@/types/lesson";
import type { SectionDef } from "@/types/section";
import { resolveSlideAnchors, describeAnchorReport } from "@/lib/slideAnchors";
import { resolveSections } from "@/lib/sections";
import { buildNotesFromLesson } from "@/lib/lessonSeed";
import NotesToSlidesGuide from "@/components/notesToSlides/NotesToSlidesGuide";
import OutlineEditor from "@/components/notesToSlides/OutlineEditor";
import type { Outline } from "@/lib/ingestionPrompt";
import type { HybridIngestRequest, HybridIngestResponse, OutlineResponse } from "@/types/ingest";
import { clearDraft } from "@/lib/draftStorage";
import { useDraftAutosave, useDraftRestore } from "@/hooks/useDraftAutosave";

const inputClass = "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardClass = "rounded-3xl p-6 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[var(--accent-text)]";

const SPINNER = (
  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

/** A long-running route (Generate/Export) that gets killed by Vercel's function timeout
 * returns its own plain-text/HTML crash page instead of JSON — res.json() then throws a
 * cryptic "Unexpected token..." parse error. Surface something actionable instead. */
async function parseJsonResponse(res: Response, timeoutHint: string) {
  try {
    return await res.json();
  } catch {
    throw new Error(timeoutHint);
  }
}

// Every other required LessonInput field defaults quietly — Notes to Slides only surfaces the
// same "Lesson Info" fields LessonForm does, matching its own EMPTY defaults for the rest.
const EMPTY_LESSON_DEFAULTS: LessonInput = {
  title: "", subtitle: "", topics: "", deadline: "", tag: "", notes: "",
  overview: "", learningTargets: "", vocabulary: "", warmUp: "", slideContent: "",
  guidedLab: "", selfPaced: "", submissionChecklist: "", checkpoint: "",
  industryBestPractices: "", devJournalPrompt: "", rubric: "", sources: "", sections: {},
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
  rawText: string;
  slideCount: string;
  ast: PresentationAST | null;
  activeIndex: number;
  viewMode: "preview" | "edit";
  outline?: Outline | null;
}

function IngestPageInner() {
  useSession({ required: true });
  const searchParams = useSearchParams();
  const router = useRouter();
  const lessonIdParam = searchParams.get("lessonId") ?? "";

  const [hasAiKey, setHasAiKey] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Assignment (course + module the lesson belongs to)
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
  // The attached lesson as loaded, kept so "Start from this lesson's content" can read its
  // classic Slide Content and section text without another fetch.
  const [attachedLesson, setAttachedLesson] = useState<Lesson | null>(null);
  const [seedStatus, setSeedStatus] = useState("");

  // Lesson info (mirrors LessonForm's "Lesson Info" section)
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [topics, setTopics] = useState("");
  const [deadline, setDeadline] = useState("");
  const [lessonType, setLessonType] = useState<LessonType>("lesson");
  const [userSectionSettings, setUserSectionSettings] = useState<{ sectionLabels?: Record<string, string>; sections?: SectionDef[] }>({});

  // The Skeleton: every active section (course-level, falling back to user/global defaults) is a
  // locked slide anchor, in order. Display copy only — the server re-resolves and enforces it.
  const slideAnchors = resolveSlideAnchors(selectedCourse, userSectionSettings);
  const courseThemeId = getTheme(selectedCourse?.settings?.defaultThemeId).id;
  // The course's Google Slides template. Export draws onto it unless the instructor unchecks it.
  const courseTemplateUrl = selectedCourse?.settings?.defaultTemplateUrl?.trim() || "";
  const [useCourseTemplate, setUseCourseTemplate] = useState(true);
  // The template's name and learned look, so the form can name it and the preview can match it.
  const [courseTemplate, setCourseTemplate] = useState<{ courseId: string; name: string | null; theme: ThemeConfig | null; error?: string } | null>(null);
  const templateInfo = courseTemplate && courseTemplate.courseId === selectedCourse?.id ? courseTemplate : null;
  const templateOn = !!courseTemplateUrl && useCourseTemplate;
  useEffect(() => {
    const id = selectedCourse?.id;
    if (!id || !courseTemplateUrl) return;
    let cancelled = false;
    fetch(`/api/courses/${id}/template-style`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data?.template) return;
        setCourseTemplate({ courseId: id, name: data.template.name ?? null, theme: data.template.theme ?? null, error: data.template.error });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedCourse?.id, courseTemplateUrl]);

  // Raw content
  const [rawText, setRawText] = useState("");
  const [slideCount, setSlideCount] = useState("");
  // No model menu: the server picks from the saved key and Profile preference (lib/aiModels.ts).
  const [savedKeys, setSavedKeys] = useState<SavedKeys | null>(null);
  const [preferredAiModel, setPreferredAiModel] = useState("auto");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  // Optional planning step: an outline the instructor reviews and edits before the deck is written.
  const [outline, setOutline] = useState<Outline | null>(null);
  const [planning, setPlanning] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [ast, setAst] = useState<PresentationAST | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  // No theme picker (removed on purpose) — the deck carries the theme it was generated with
  // (the course default, else the global default), and preview + export both use that.
  const theme = getTheme(ast?.themeId ?? courseThemeId);
  // What the server had to fix to lock the skeleton (missing/out-of-order anchors), if anything.
  const [anchorNotes, setAnchorNotes] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedJustNow, setSavedJustNow] = useState(false);

  // Save Draft on the input form itself — persists Lesson Info to a real Lesson record before
  // any slides exist, independent of the "Save Draft" on the result view (which saves the AST).
  const [savingInfo, setSavingInfo] = useState(false);
  const [saveInfoError, setSaveInfoError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Shown on the fresh form after an export or a Save Draft: what was saved and where. Export
  // includes the deck's link, since the new tab it opens can be popup-blocked.
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [doneNotice, setDoneNotice] = useState<{ title: string; message: string; url?: string; lessonId?: string } | null>(null);

  // Keyed by whichever lesson this generation is (or will be) attached to — once ensureLesson()
  // resolves a real id, the draft moves under that id so it stays tied to the right lesson.
  const draftKey = `ingest:${existingLessonId || lessonId || lessonIdParam || "new"}`;
  // Restore only after the initial settings/courses fetch (and, if deep-linked, the lesson
  // fetch) has landed — otherwise those async .then() callbacks resolve after restore and
  // silently overwrite the just-restored fields with server defaults.
  useDraftRestore<IngestDraft>(settingsLoaded && (!lessonIdParam || existingLessonId) ? draftKey : null, (draft) => {
    // Unfinished work comes back after a refresh or navigation, but say so (with a way out) so
    // a restored form isn't mistaken for the last deck failing to clear.
    if (draftKey === "ingest:new" && (draft.title?.trim() || draft.rawText?.trim() || draft.selectedCourseId || draft.ast)) {
      setRestoredDraft(true);
    }
    setSelectedCourseId(draft.selectedCourseId);
    setSelectedModuleId(draft.selectedModuleId);
    setSelectedExistingLessonId(draft.selectedExistingLessonId);
    setTitle(draft.title);
    setSubtitle(draft.subtitle);
    setTopics(draft.topics);
    setDeadline(draft.deadline);
    setLessonType(draft.lessonType);
    setRawText(draft.rawText);
    setSlideCount(draft.slideCount);
    setAst(draft.ast);
    setActiveIndex(draft.activeIndex);
    setViewMode(draft.viewMode);
    setOutline(draft.outline ?? null);
  });
  // Once this form is tied to a lesson, its draft lives under that lesson's key. Drop the copy
  // left under "ingest:new", or the next visit to a blank Notes to Slides restores this deck's
  // course, title and notes as if they were a new, unfinished one.
  const tiedToLesson = !!(existingLessonId || lessonId);
  useEffect(() => {
    if (tiedToLesson) clearDraft("ingest:new");
  }, [tiedToLesson]);
  useDraftAutosave<IngestDraft>(draftKey, {
    selectedCourseId, selectedModuleId, selectedExistingLessonId,
    title, subtitle, topics, deadline, lessonType,
    rawText, slideCount,
    ast, activeIndex, viewMode, outline,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/user/settings").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]).then(([settings, coursesData]) => {
      setHasAiKey(!!(settings.hasKey || settings.hasGeminiKey));
      setSavedKeys({ anthropic: !!settings.hasKey, gemini: !!settings.hasGeminiKey });
      setPreferredAiModel(settings.preferredAiModel ?? "auto");
      setUserSectionSettings({ sectionLabels: settings.sectionLabels, sections: settings.sections });
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);

  // Update modules + pull course defaults whenever the selected course changes
  useEffect(() => {
    const course = courses.find(c => c.id === selectedCourseId);
    setModules(Array.isArray(course?.modules) ? course!.modules : []);
    setSelectedModuleId("");
  }, [selectedCourseId, courses]);

  // Deep-link: ?lessonId= arrives from an existing lesson's own hub page — pre-fill
  // everything from that lesson and lock the attachment so it can't be picked away by accident.
  useEffect(() => {
    if (!lessonIdParam) return;
    fetch(`/api/lessons/${lessonIdParam}`).then(r => r.ok ? r.json() : null).then((lesson: Lesson | null) => {
      if (!lesson) return;
      setExistingLessonId(lesson.id);
      setSelectedExistingLessonId(lesson.id);
      setAttachedLessonTitle(lesson.title);
      setAttachedLesson(lesson);
      setLockedFromQuery(true);
      setSelectedCourseId(lesson.courseId ?? "");
      setTitle(lesson.title);
      setSubtitle(lesson.subtitle ?? "");
      setTopics(lesson.topics ?? "");
      setDeadline(lesson.deadline ?? "");
      setLessonType((lesson.lessonType as LessonType) ?? "lesson");
      // Already know which lesson this is — let Save Draft/Export use it immediately
      // instead of waiting on ensureLesson() to resolve it again via existingLessonId.
      setLessonId(lesson.id);
      if (lesson.slideNotes) setRawText(lesson.slideNotes);
      if (lesson.presentationAST) {
        setAst(lesson.presentationAST);
        setActiveIndex(0);
        setViewMode("preview");
      }
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
    if (!id) {
      // Switched back to "Create new lesson" — clear anything a previously-picked
      // lesson's draft may have restored, same as handleDetachLesson.
      setExistingLessonId(null);
      setAttachedLesson(null);
      setLessonId(null);
      setAst(null);
      setActiveIndex(0);
      setViewMode("preview");
      return;
    }
    const lesson = courseLessons.find(l => l.id === id);
    if (!lesson) return;
    setExistingLessonId(lesson.id);
    setAttachedLesson(lesson);
    setTitle(lesson.title);
    setSubtitle(lesson.subtitle ?? "");
    setTopics(lesson.topics ?? "");
    setDeadline(lesson.deadline ?? "");
    setLessonType((lesson.lessonType as LessonType) ?? "lesson");
    setLessonId(lesson.id);
    if (lesson.slideNotes) setRawText(lesson.slideNotes);
    // Reset first, then repopulate — otherwise switching from a lesson with a saved
    // draft to one without would leave the previous lesson's deck lingering in state.
    setActiveIndex(0);
    setViewMode("preview");
    setAst(lesson.presentationAST ?? null);
  }

  // Classic content on the attached lesson, as Notes to Slides notes ("" when there's none).
  const seedNotes = attachedLesson
    ? buildNotesFromLesson(attachedLesson, resolveSections({ course: selectedCourse, userSettings: userSectionSettings }))
    : "";

  /** Bridge from retired Classic Slides: loads the lesson's Slide Content and slide-heading sections
   * into the notes box. Appends below anything already typed so nothing is lost. */
  function handleSeedFromLesson() {
    if (!seedNotes) return;
    setRawText(prev => (prev.trim() ? `${prev.trimEnd()}\n\n${seedNotes}` : seedNotes));
    setSeedStatus(rawText.trim()
      ? "Added this lesson's content below your notes."
      : "Loaded this lesson's content into the notes box.");
  }

  function handleDetachLesson() {
    setExistingLessonId(null);
    setAttachedLesson(null);
    setSeedStatus("");
    setSelectedExistingLessonId("");
    setLockedFromQuery(false);
    setAttachedLessonTitle("");
    // The deep-link effect may have restored this lesson's saved draft (and pointed
    // lessonId at it) — clear that out too, or a detached page would still silently
    // Save Draft/Export onto the lesson just detached from.
    setLessonId(null);
    setAst(null);
    setActiveIndex(0);
    setViewMode("preview");
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

  /** Pushes the current Lesson Info fields to the lesson — updates one in place if it's already
   * attached or was already created this session, otherwise creates a fresh one. Unlike
   * ensureLesson(), this always pushes whatever's currently in the fields, so repeated calls
   * (the input form's own "Save Draft" button) pick up edits made since the last save. */
  async function saveLessonInfo(): Promise<string> {
    const body = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      topics: topics.trim(),
      deadline,
      lessonType,
      courseId: selectedCourseId,
      slideNotes: rawText,
    };

    const targetId = lessonId || existingLessonId;
    let newLessonId: string;
    if (targetId) {
      // Attached to (or already created earlier this session) a lesson — update it in place
      // rather than creating a duplicate.
      const res = await fetch(`/api/lessons/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJsonResponse(res, "Saving took too long and timed out. Try again in a moment.");
      if (!res.ok) throw new Error(data.error || "Failed to update the lesson.");
      newLessonId = targetId;
    } else {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...EMPTY_LESSON_DEFAULTS, ...body }),
      });
      const data = await parseJsonResponse(res, "Saving took too long and timed out. Try again in a moment.");
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

  /** Creates (or reuses an attached) lesson this generation will be saved onto — once per
   * session, reused on regenerate without re-pushing Lesson Info. */
  async function ensureLesson(): Promise<string> {
    if (lessonId) return lessonId;
    return saveLessonInfo();
  }

  function ingestPayload(): HybridIngestRequest {
    return {
      courseConfig: { courseId: selectedCourseId, anchors: slideAnchors, themeId: courseThemeId },
      rawNotes: rawText,
      slideCount: slideCount ? Number(slideCount) : undefined,
      lessonTitle: title.trim() || undefined,
      lessonSubtitle: subtitle.trim() || undefined,
      topics: topics.trim() || undefined,
    };
  }

  /** Plan first: a quick outline to review and edit before the full deck is written. */
  async function handlePlanOutline() {
    if (!rawText.trim() || !title.trim() || !selectedCourseId || planning || generating) return;
    setDoneNotice(null);
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/ingest/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingestPayload()),
      });
      const data = await parseJsonResponse(res, "Planning took too long and timed out. Try again, or generate the slides directly.");
      if (!res.ok) throw new Error(data.error || "Failed to plan the outline.");
      setOutline((data as OutlineResponse).outline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to plan the outline.");
    } finally {
      setPlanning(false);
    }
  }

  async function handleGenerate() {
    if (!rawText.trim() || !title.trim() || !selectedCourseId || generating) return;
    setDoneNotice(null);
    setGenerating(true);
    setError(null);
    startProgressAnimation();
    try {
      await ensureLesson();
      const planned = outline?.slides.filter(o => o.title.trim());
      const payload: HybridIngestRequest = {
        ...ingestPayload(),
        // A reviewed outline's cover title and tagline win over Lesson Info's.
        ...(outline?.lessonTitle.trim() ? { lessonTitle: outline.lessonTitle.trim() } : {}),
        ...(outline?.lessonSubtitle?.trim() ? { lessonSubtitle: outline.lessonSubtitle.trim() } : {}),
        ...(planned?.length ? { outline: planned } : {}),
      };
      const res = await fetch("/api/ai/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonResponse(res, "Generation took too long and timed out. Try shortening your notes or splitting them into a smaller batch, then generate again.");
      if (!res.ok) throw new Error(data.error || "Failed to generate slides.");
      const result = data as HybridIngestResponse;
      stopProgressAnimation(100);
      setAst(result.ast);
      setOutline(null);
      setAnchorNotes(describeAnchorReport(result.anchorReport));
      setActiveIndex(0);
      setViewMode("preview");
    } catch (err) {
      stopProgressAnimation(0);
      setError(err instanceof Error ? err.message : "Failed to generate slides.");
    } finally {
      setGenerating(false);
    }
  }

  /** Save Draft on the input form — persists Lesson Info to the server before/without ever
   * generating slides, so it survives a cleared browser or a switch to a different device (the
   * localStorage draft autosave already covers same-browser refreshes/navigation on its own). */
  async function handleSaveDraftInfo() {
    if (!title.trim() || !selectedCourseId || savingInfo) return;
    setSavingInfo(true);
    setSaveInfoError(null);
    try {
      const savedId = await saveLessonInfo();
      const savedTitle = title.trim();
      // Saved to the lesson (info + notes), so clear the form for the next one. Reopen it from
      // the lesson page, or pick it under "Attach to Lesson".
      resetForNextDeck();
      setDoneNotice({ title: savedTitle, message: "was saved as a draft lesson with your notes.", lessonId: savedId });
    } catch (err) {
      setSaveInfoError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSavingInfo(false);
    }
  }

  function handleClearLessonInfo() {
    setTitle("");
    setSubtitle("");
    setTopics("");
    setDeadline("");
    setLessonType("lesson");
  }

  function handleStartOver() {
    // Clear whatever's autosaved under the CURRENT draft key before anything below changes it
    // (lessonId flipping to null moves draftKey back to "ingest:new"/lessonIdParam) — otherwise
    // the just-generated deck stays orphaned in localStorage and silently reappears the next
    // time something (a refresh, the deep-link effect, re-attaching to the same lesson) lands
    // back on that same key, making the reset look like it never happened.
    clearDraft(draftKey);
    setAst(null);
    setOutline(null);
    setAnchorNotes([]);
    setActiveIndex(0);
    setError(null);
    setExportError(null);
    setSaveError(null);
    setLessonId(null);
    setViewMode("preview");
  }

  /** After an export the job is done: back to a completely blank form, as if the page had just
   * been opened, so the next deck doesn't start from the last one's course, lesson and notes. */
  function resetForNextDeck() {
    handleStartOver();
    // The key changes to "ingest:new" below, and the restore hook would otherwise load whatever
    // older draft is still saved there, bringing back a previous deck's fields.
    clearDraft("ingest:new");
    setSelectedCourseId("");
    setSelectedModuleId("");
    setExistingLessonId(null);
    setSelectedExistingLessonId("");
    setAttachedLesson(null);
    setAttachedLessonTitle("");
    setLockedFromQuery(false);
    setSeedStatus("");
    handleClearLessonInfo();
    setRawText("");
    setSlideCount("");
    setSaveInfoError(null);
    setRestoredDraft(false);
    // Drop ?lessonId= so a refresh doesn't re-attach the lesson just exported.
    if (lessonIdParam) router.replace("/ingest");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(): Promise<boolean> {
    if (!ast || !lessonId || saving) return false;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationAST: ast,
          selectedTheme: ast.themeId ?? courseThemeId,
          presentationStatus: "draft",
          slideNotes: rawText,
        }),
      });
      const data = await parseJsonResponse(res, "Saving took too long and timed out. Try again in a moment.");
      if (!res.ok) throw new Error(data.error || "Failed to save to the lesson.");
      clearDraft(draftKey);
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2500);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save to the lesson.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** The result view's Save Draft: saves the deck onto its lesson, then clears the form the same
   * way an export does. (Leaving Edit mode also saves, but stays on the deck.) */
  async function handleSaveDraftAndClear() {
    const savedId = lessonId;
    const savedTitle = ast?.lessonTitle || title.trim() || "Slide deck";
    if (!(await handleSave())) return;
    resetForNextDeck();
    setDoneNotice({ title: savedTitle, message: "was saved as a draft on its lesson.", lessonId: savedId ?? undefined });
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
        body: JSON.stringify({
          ast, lessonId: lessonId ?? undefined, courseId: selectedCourseId || undefined,
          useTemplate: useCourseTemplate,
        }),
      });
      const data = await parseJsonResponse(res, "Creating the deck took too long and timed out. Try again in a moment.");
      if (!res.ok) throw new Error(data.error || "Failed to create the slide deck.");
      const exportedTitle = ast.lessonTitle || title.trim() || "Slide deck";
      const exportedLessonId = lessonId;
      window.open(data.url, "_blank", "noopener,noreferrer");
      // Export is the end of this page's job: clear everything (not just the deck, which is all
      // Start Over clears) and keep a link to the deck in case the new tab was blocked.
      resetForNextDeck();
      setDoneNotice({ title: exportedTitle, message: "was exported to Drive and saved under its lesson.", url: data.url, lessonId: exportedLessonId ?? undefined });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to create the slide deck.");
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

      {restoredDraft && !doneNotice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3" style={{ background: "var(--accent-bg)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            We brought back the unfinished deck you were working on in this browser.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { resetForNextDeck(); setRestoredDraft(false); }} className="text-sm font-semibold hover:underline min-h-6 px-1" style={{ color: "var(--accent-text)" }}>
              Start fresh
            </button>
            <button type="button" onClick={() => setRestoredDraft(false)} className="text-xs font-semibold min-h-6 px-1" style={{ color: "var(--text-muted)" }} aria-label="Keep working and dismiss message">
              Keep working
            </button>
          </div>
        </div>
      )}

      {doneNotice && !ast && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3" style={{ background: "var(--accent-bg)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            <span className="font-semibold">{doneNotice.title}</span> {doneNotice.message} The form is cleared for your next deck.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {doneNotice.url && (
              <a href={doneNotice.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
                Open deck ↗
              </a>
            )}
            {doneNotice.lessonId && (
              <Link href={`/lessons/${doneNotice.lessonId}`} className="text-sm font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
                Go to lesson →
              </Link>
            )}
            <button type="button" onClick={() => setDoneNotice(null)} className="text-xs font-semibold min-h-6 px-1" style={{ color: "var(--text-muted)" }} aria-label="Dismiss message">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!ast && <NotesToSlidesGuide />}

      {settingsLoaded && !hasAiKey ? (
        <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No AI API key configured</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Add a Claude or Gemini API key to use AI ingestion.</p>
          <Link
            href="/profile"
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-[#0a0b13] hover:opacity-90 transition"
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
              <label htmlFor="ingest-course" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Course <span className="text-[var(--danger-text)]">*</span>
              </label>
              <select id="ingest-course" required disabled={lockedFromQuery} value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className={inputClass} style={inputStyle}>
                <option value="">— Select a course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            {selectedCourseId && modules.length > 0 && !lockedFromQuery && (
              <div>
                <label htmlFor="ingest-module-optional" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Module <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <select id="ingest-module-optional" value={selectedModuleId} onChange={e => setSelectedModuleId(e.target.value)} className={inputClass} style={inputStyle}>
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
                <label htmlFor="ingest-attach-to-lesson-optional" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Attach to Lesson <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <select id="ingest-attach-to-lesson-optional" value={selectedExistingLessonId} onChange={e => handlePickExistingLesson(e.target.value)} className={inputClass} style={inputStyle}>
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

          {/* ── Lesson Info (mirrors LessonForm's "Lesson Info" card) ── */}
          <div className={cardClass} style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className={sectionLabel}>Lesson Info</p>
              <button
                type="button"
                onClick={handleClearLessonInfo}
                className="text-[10px] font-semibold rounded-full px-2 py-0.5 transition hover:bg-red-500/10 hover:text-[var(--danger-text)]"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Clear
              </button>
            </div>

            <div>
              <label htmlFor="ingest-lesson-title-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Lesson Title <span className="text-[var(--danger-text)]">*</span> {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}
              </label>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Module number and lesson number (e.g. Module 3, Lesson 2)</p>
              <input id="ingest-lesson-title-used-by-ai"
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
              <label htmlFor="ingest-lesson-subtitle-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Lesson Subtitle {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}
              </label>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Specific topic or subject covered in this lesson</p>
              <input id="ingest-lesson-subtitle-used-by-ai"
                type="text"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                placeholder="e.g. Introduction to Persuasive Writing"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="ingest-topics-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Topics {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}
              </label>
              <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Comma-separated. Extra context passed to Notes to Slides alongside your raw notes.</p>
              <input id="ingest-topics-used-by-ai"
                type="text"
                value={topics}
                onChange={e => setTopics(e.target.value)}
                placeholder="e.g. Claims, Evidence, Counterarguments"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ingest-deadline" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline</label>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>The due date for this lesson&apos;s assignments.</p>
                <input id="ingest-deadline"
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className={`${inputClass} ${deadline ? "" : "text-[var(--text-muted)]"}`}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="ingest-lesson-type" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Lesson Type</label>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Classify the type of activity for this lesson.</p>
                <select id="ingest-lesson-type"
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

          </div>

          {/* ── Generate: the Skeleton (locked course anchors) and the Content (freeform notes)
                side by side on one screen — the hybrid ingestion model. ── */}
          <div className={cardClass} style={cardStyle}>
            <div>
              <p className={sectionLabel}>Generate Deck</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Paste your notes. The AI sorts them under the course&apos;s slide headings, expands them, and picks a layout for each slide.
              </p>
            </div>

            {/* Skeleton: a slim, secondary strip. The headings are fixed by Course Settings, so this
                only shows what they are; the Content box below is where the work happens. */}
            <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  🔒 Slide headings{selectedCourse && slideAnchors.length > 0 ? ` (${slideAnchors.length})` : ""}
                </p>
                {selectedCourse && (
                  <Link href={`/courses/${selectedCourse.id}/settings`} className="text-[11px] font-semibold shrink-0 hover:underline" style={{ color: "var(--accent-text)" }}>
                    Edit in Course Settings
                  </Link>
                )}
              </div>
              {!selectedCourse ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Select a course above to load its slide headings.</p>
              ) : slideAnchors.length > 0 ? (
                <ol className="flex flex-wrap gap-1" aria-label={`Locked slide headings from ${selectedCourse.title}`} title="From this course's sections marked “Slide heading”. Used exactly as written, in this order.">
                  {slideAnchors.map((anchor, i) => (
                    <li key={anchor.id} className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <span className="tabular-nums mr-1" style={{ color: "var(--text-muted)" }}>{i + 1}</span>{anchor.label}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>None set, so the AI structures the deck from your notes alone.</p>
              )}
              {selectedCourse && (courseTemplateUrl ? (
                <label htmlFor="ingest-use-course-template" className="flex items-start gap-2 pt-1 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                  <input
                    id="ingest-use-course-template"
                    type="checkbox"
                    className="mt-0.5"
                    checked={useCourseTemplate}
                    onChange={e => setUseCourseTemplate(e.target.checked)}
                  />
                  <span>
                    Use course template:{" "}
                    <a href={courseTemplateUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent-text)" }}>
                      {templateInfo?.name ?? "open template"}
                    </a>
                    <span className="block text-[11px]" style={{ color: templateInfo?.error && useCourseTemplate ? "var(--danger-text)" : "var(--text-muted)" }}>
                      {!useCourseTemplate
                        ? `The preview and export use the built-in ${getTheme(courseThemeId).name} look instead.`
                        : templateInfo?.error
                          ? templateInfo.error
                          : templateInfo && !templateInfo.theme
                            ? "Export copies this template. Its look comes from its theme, which the preview can't show, so the preview uses the built-in look."
                            : "The preview and the Google Slides export follow this template's look."}
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-[11px] pt-1" style={{ color: "var(--text-muted)" }}>
                  No Slides template on this course, so export uses the built-in {getTheme(courseThemeId).name} look.{" "}
                  <Link href={`/courses/${selectedCourse.id}/settings`} className="underline" style={{ color: "var(--accent-text)" }}>Add one in Course Settings</Link>
                </p>
              ))}
            </div>

            {/* Content: the main field. */}
            <div className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label htmlFor="ingest-content-notes-outline-or-brain" className="block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Content · notes, outline, or brain-dump <span className="text-[var(--danger-text)]">*</span>
              </label>
              {seedNotes && (
                <button
                  type="button"
                  onClick={handleSeedFromLesson}
                  className="text-[11px] font-semibold rounded-full px-3 py-1 min-h-6 transition hover:opacity-80"
                  style={{ background: "var(--accent-bg)", color: "var(--accent-text)", border: "1px solid var(--border)" }}
                >
                  Start from this lesson&apos;s content
                </button>
              )}
            </div>
            {seedNotes && (
              <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                This lesson has saved content (from Classic Slides or Edit Content). Load it here as a starting point, then generate.
              </p>
            )}
            <p role="status" aria-live="polite" className="text-[11px]" style={{ color: "var(--success-text)" }}>{seedStatus}</p>
            <textarea id="ingest-content-notes-outline-or-brain"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              rows={18}
              placeholder={"Paste raw outlines, meeting notes, or loose bullets, e.g.\n- explain the core concept\n- compare two approaches or viewpoints\n- steps to complete the process\n\nYou don't need to match the section names; the AI sorts points under the right heading."}
              className={`${inputClass} min-h-[20rem]`}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <AiModelNote preference={preferredAiModel} keys={savedKeys} />
              <div className="w-44">
                <label htmlFor="ingest-approx-slide-count-optional" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Approx. Slide Count <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input id="ingest-approx-slide-count-optional"
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

            {error && <p role="alert" className="text-xs text-[var(--danger-text)]">{error}</p>}
            {saveInfoError && <p role="alert" className="text-xs text-[var(--danger-text)]">{saveInfoError}</p>}

            {outline && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--accent)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={sectionLabel}>Outline</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      Review the plan: change headlines or layouts, add or remove slides, then generate. The deck follows this outline.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOutline(null)}
                    className="shrink-0 text-[11px] font-semibold hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Discard outline
                  </button>
                </div>
                <OutlineEditor outline={outline} onChange={setOutline} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || planning || !rawText.trim() || !title.trim() || !selectedCourseId}
                title={!selectedCourseId ? "Select a course first" : !title.trim() ? "Add a lesson title first" : undefined}
                className="shrink-0 rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    {SPINNER}
                    Generating slides…
                  </span>
                ) : outline ? "Generate from Outline" : "Generate Slides"}
              </button>

              {!outline && (
                <button
                  onClick={handlePlanOutline}
                  disabled={planning || generating || !rawText.trim() || !title.trim() || !selectedCourseId}
                  title={!selectedCourseId ? "Select a course first" : !title.trim() ? "Add a lesson title first" : "Get a one-line-per-slide plan to review and edit before the deck is written"}
                  className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50"
                  style={{ background: "var(--accent-bg)", color: "var(--accent-text)", border: "1px solid var(--accent)" }}
                >
                  {planning ? (
                    <span className="flex items-center gap-2">
                      {SPINNER}
                      Planning…
                    </span>
                  ) : "Plan Outline First"}
                </button>
              )}

              <button
                onClick={handleSaveDraftInfo}
                disabled={savingInfo || !title.trim() || !selectedCourseId}
                title={!selectedCourseId ? "Select a course first" : !title.trim() ? "Add a lesson title first" : "Save the Lesson Info and your notes to the lesson without generating yet, then clear the form"}
                className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50"
                style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {savingInfo ? "Saving…" : "Save Draft"}
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
              {/* The look can be changed after generating: the course template, or any built-in look. */}
              <label htmlFor="ingest-deck-look" className="mt-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                Look
                <select
                  id="ingest-deck-look"
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  value={templateOn ? "course-template" : theme.id}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "course-template") {
                      setUseCourseTemplate(true);
                    } else {
                      setUseCourseTemplate(false);
                      setAst({ ...ast, themeId: v });
                    }
                  }}
                >
                  {courseTemplateUrl && <option value="course-template">Course template{templateInfo?.name ? `: ${templateInfo.name}` : ""}</option>}
                  {THEMES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
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
                ) : courseTemplateUrl && useCourseTemplate ? "Export to Google Slides" : "Export to PowerPoint"}
              </button>
              <button
                onClick={handleSaveDraftAndClear}
                disabled={saving}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {saving ? "Saving…" : savedJustNow ? "Saved ✓" : "Save Draft"}
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

          {anchorNotes.length > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs space-y-0.5" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
              {anchorNotes.map(note => <p key={note}>{note}</p>)}
            </div>
          )}
          {exportError && <p role="alert" className="text-xs text-[var(--danger-text)]">{exportError}</p>}
          {saveError && <p role="alert" className="text-xs text-[var(--danger-text)]">{saveError}</p>}

          {viewMode === "edit" ? (
            <SlideEditorPanel ast={ast} activeIndex={activeIndex} onChange={setAst} onActiveIndexChange={setActiveIndex} />
          ) : (
            <>
              {/* Active slide, drawn by the same layouts the export uses (one notes slide can become
                  more than one deck slide when a long list is split). The cover leads slide 1. */}
              {(() => {
                const previewTheme = templateOn && templateInfo?.theme ? templateInfo.theme : theme;
                const slide = ast.slides[activeIndex];
                const parts = deckSlidesFor(ast, activeIndex);
                const cover = activeIndex === 0 ? astToDeck({ ...ast, slides: [] }).slides[0] : undefined;
                return (
                  <div className="space-y-3">
                    {cover && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Cover</p>
                        <SlideCanvas layout={layoutSlide(cover)} theme={previewTheme} showWarnings={false} label="Cover slide" className="rounded-xl" />
                      </div>
                    )}
                    {parts.map(s => (
                      <SlideCanvas key={s.id} layout={layoutSlide(s)} theme={previewTheme} showWarnings={false} label={`Slide ${activeIndex + 1}: ${slide?.title ?? ""}`} className="rounded-xl" />
                    ))}
                    {slide?.notes?.trim() && (
                      <div className="rounded-xl px-4 py-3 text-xs space-y-1" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                        <p className="font-semibold uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Speaker notes</p>
                        <p className="whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{slide.notes}</p>
                      </div>
                    )}
                    {templateOn && templateInfo?.theme && (
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Shown in {templateInfo.name ?? "the course template"}&apos;s colors and fonts. Its background art and logos are added when you export.
                      </p>
                    )}
                  </div>
                );
              })()}

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
