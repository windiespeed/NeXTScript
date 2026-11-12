"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Lesson, LessonResource } from "@/types/lesson";
import type { SavedProject } from "@/types/project";
import type { Course, CourseModule } from "@/types/course";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Dialog from "@/components/ui/Dialog";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[var(--accent-text)]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  lesson:     { bg: "rgba(12,192,223,0.12)",  text: "var(--accent-text)" },
  practice:   { bg: "var(--accent-purple-bg)", text: "var(--accent-purple)" },
  project:    { bg: "rgba(255,140,74,0.12)",  text: "var(--warning-text)" },
  assessment: { bg: "rgba(45,212,160,0.12)",  text: "var(--success-text)" },
  review:     { bg: "var(--bg-card-hover)",   text: "var(--text-muted)" },
};

const RESOURCE_ICON: Record<LessonResource["type"], React.ReactNode> = {
  doc: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  sheet: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
  slides: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  form: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  link: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  pdf: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  image: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  other: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
};

const RESOURCE_COLOR: Record<LessonResource["type"], string> = {
  doc: "#0cc0df", sheet: "#2dd4a0", slides: "var(--accent-purple)",
  form: "#ff8c4a", link: "var(--text-secondary)", pdf: "#ef4444",
  image: "#ff8c4a", other: "var(--text-muted)",
};

type HubWidgetId = "generate" | "resources";
const DEFAULT_HUB_ORDER: HubWidgetId[] = ["generate", "resources"];
const DEFAULT_HUB_SIZES: Record<HubWidgetId, 1 | 2> = { generate: 1, resources: 1 };

function SortableHubWidget({ widgetId, span, onCycleSize, children }: {
  widgetId: HubWidgetId;
  span: 1 | 2;
  onCycleSize: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widgetId });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : undefined }}
      className={`relative group/widget ${span === 2 ? "md:col-span-2" : "md:col-span-1"}`}
    >
      <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover/widget:opacity-100 group-focus-within/widget:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center gap-1">
        <div
          {...listeners}
          {...attributes}
          title="Drag to reorder"
          aria-label="Reorder widget"
          className="flex items-center justify-center rounded-full p-1.5 cursor-grab active:cursor-grabbing"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)", color: "var(--text-secondary)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
        <button
          onClick={onCycleSize}
          title={`Resize (${span}/2 columns)`}
          aria-label={`Resize widget, currently ${span} of 2 columns`}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)", color: "var(--text-secondary)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          {span}/2
        </button>
      </div>
      {children}
    </div>
  );
}

export default function LessonHubPage() {
  useSession({ required: true });
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseModules, setCourseModules] = useState<CourseModule[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [assigningCourse, setAssigningCourse] = useState(false);
  const [loading, setLoading] = useState(true);

  const [hasAiKey, setHasAiKey] = useState(false);

  // Add resource state
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState<LessonResource["type"]>("link");
  const [savingLink, setSavingLink] = useState(false);

  // Add resource dropdown
  const [addResourceOpen, setAddResourceOpen] = useState(false);

  // Add blank doc state
  const [addingBlankDoc, setAddingBlankDoc] = useState(false);
  const [blankDocName, setBlankDocName] = useState("");
  const [blankDocType, setBlankDocType] = useState<"doc" | "sheet" | "slides">("doc");
  const [savingBlankDoc, setSavingBlankDoc] = useState(false);

  // Edit metadata state
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaSubtitle, setMetaSubtitle] = useState("");
  const [metaTopics, setMetaTopics] = useState("");
  const [metaDeadline, setMetaDeadline] = useState("");
  const [metaType, setMetaType] = useState("lesson");
  const [savingMeta, setSavingMeta] = useState(false);

  // Overview Doc generation — always single-instance (deleted + replaced), built from
  // whichever decks/quizzes are selected here rather than the lesson's own content fields.
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(new Set());
  const [generatingOverview, setGeneratingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  // Widget order + sizes
  const [hubOrder, setHubOrder] = useState<HubWidgetId[]>(DEFAULT_HUB_ORDER);
  const [hubSizes, setHubSizes] = useState<Record<HubWidgetId, 1 | 2>>(DEFAULT_HUB_SIZES);
  const hubSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    try {
      const o = localStorage.getItem(`hub-widget-order-${id}`);
      if (o) setHubOrder(JSON.parse(o));
      const s = localStorage.getItem(`hub-widget-sizes-${id}`);
      if (s) setHubSizes(JSON.parse(s));
    } catch {}
  }, [id]);

  function cycleHubSize(wid: HubWidgetId) {
    setHubSizes(prev => {
      const next = { ...prev, [wid]: prev[wid] === 1 ? 2 : 1 } as Record<HubWidgetId, 1 | 2>;
      localStorage.setItem(`hub-widget-sizes-${id}`, JSON.stringify(next));
      return next;
    });
  }

  function handleHubDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setHubOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id as HubWidgetId), prev.indexOf(over.id as HubWidgetId));
      localStorage.setItem(`hub-widget-order-${id}`, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/lessons/${id}`).then(r => r.ok ? r.json() : null),
      fetch("/api/projects").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
      fetch("/api/user/settings").then(r => r.json()),
    ]).then(([lessonData, projectData, coursesData, settings]) => {
      setAllCourses(Array.isArray(coursesData) ? coursesData : []);
      setHasAiKey(settings.hasKey ?? false);
      setLesson(lessonData);
      setProjects(Array.isArray(projectData) ? projectData : []);

      if (lessonData?.courseId) {
        fetch(`/api/courses/${lessonData.courseId}`).then(r => r.json()).then(c => {
          setCourse(c);
          if (Array.isArray(c?.modules)) setCourseModules(c.modules);
        }).catch(() => {});
      }
      setLoading(false);
    });
  }, [id]);

  function startEditMeta() {
    if (!lesson) return;
    setMetaTitle(lesson.title);
    setMetaSubtitle(lesson.subtitle ?? "");
    setMetaTopics(lesson.topics ?? "");
    setMetaDeadline(lesson.deadline ?? "");
    setMetaType(lesson.lessonType ?? "lesson");
    setEditingMeta(true);
  }

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/lessons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: metaTitle, subtitle: metaSubtitle, topics: metaTopics, deadline: metaDeadline, lessonType: metaType }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      setLesson(updated);
      setEditingMeta(false);
    } catch {
      alert("Failed to save changes.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    setSavingLink(true);
    try {
      const res = await fetch(`/api/lessons/${id}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: linkLabel, url: linkUrl, type: linkType }),
      });
      const resource = await res.json();
      setLesson(prev => prev ? { ...prev, resources: [...(prev.resources ?? []), resource] } : prev);
      setLinkLabel(""); setLinkUrl(""); setLinkType("link"); setAddingLink(false);
    } catch {
      alert("Failed to add link.");
    } finally {
      setSavingLink(false);
    }
  }

  async function handleCreateBlankDoc() {
    if (!blankDocName.trim()) return;
    setSavingBlankDoc(true);
    try {
      const res = await fetch(`/api/lessons/${id}/blank-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: blankDocName, docType: blankDocType }),
      });
      const resource = await res.json();
      setLesson(prev => prev ? { ...prev, resources: [...(prev.resources ?? []), resource] } : prev);
      setBlankDocName(""); setAddingBlankDoc(false);
    } catch {
      alert("Failed to create document.");
    } finally {
      setSavingBlankDoc(false);
    }
  }

  async function handleAssignCourse(newCourseId: string | null) {
    setAssigningCourse(false);
    if (!lesson) return;
    const oldCourseId = lesson.courseId;
    if (oldCourseId === (newCourseId ?? undefined)) return;

    await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: newCourseId ?? null, released: false }),
    });

    if (oldCourseId) {
      const oldCourse = allCourses.find(c => c.id === oldCourseId);
      if (oldCourse) {
        await fetch(`/api/courses/${oldCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: oldCourse.lessonIds.filter(lid => lid !== id) }),
        });
      }
    }

    if (newCourseId) {
      const newCourse = allCourses.find(c => c.id === newCourseId);
      if (newCourse && !newCourse.lessonIds.includes(id)) {
        await fetch(`/api/courses/${newCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: [...newCourse.lessonIds, id] }),
        });
      }
      const fetchedCourse = await fetch(`/api/courses/${newCourseId}`).then(r => r.json());
      setCourse(fetchedCourse);
      setCourseModules(Array.isArray(fetchedCourse?.modules) ? fetchedCourse.modules : []);
    } else {
      setCourse(null);
      setCourseModules([]);
    }

    setLesson(prev => prev ? { ...prev, courseId: newCourseId ?? undefined, released: false } : prev);
  }

  async function handleDeleteResource(rid: string) {
    await fetch(`/api/lessons/${id}/resources/${rid}`, { method: "DELETE" });
    setLesson(prev => prev ? { ...prev, resources: (prev.resources ?? []).filter(r => r.id !== rid) } : prev);
  }

  async function handleDeleteProject(projectId: string, label: string) {
    if (!confirm(`Delete "${label}"? This also removes the file from Google Drive.`)) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) setProjects(prev => prev.filter(p => p.id !== projectId));
  }

  async function handleRenameProject(projectId: string, newTitle: string): Promise<boolean> {
    const trimmed = newTitle.trim();
    if (!trimmed) return false;
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) return false;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, title: trimmed } : p));
    return true;
  }

  // The unexported Notes to Slides draft lives on the lesson itself (lesson.presentationAST),
  // not as a SavedProject — so it can't go through handleDeleteProject/DELETE /api/projects.
  async function handleDeleteSlideDraft() {
    if (!confirm("Delete this Notes to Slides draft? This cannot be undone.")) return;
    const res = await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presentationAST: null, presentationStatus: null }),
    });
    if (res.ok) setLesson(prev => prev ? { ...prev, presentationAST: undefined, presentationStatus: undefined } : prev);
  }

  if (loading) return <p className="text-sm text-[var(--accent-text)] mt-10">Loading…</p>;
  if (!lesson) return <p className="text-sm text-[var(--danger-text)] mt-10">Lesson not found.</p>;

  const currentModule = courseModules.find(m => m.lessonIds.includes(id));
  const backHref = lesson.courseId ? `/courses/${lesson.courseId}` : "/lessons";

  // A lesson can now have several decks (every Generate/Export click adds a new, distinctly
  // named one instead of silently replacing the last) — already sorted newest-first by
  // projectStore.getAll. The unexported draft (if any) is independent of how many exist.
  const decks = projects.filter(p => p.type === "deck" && (p.lessonId === id || p.lessonIds?.includes(id)));
  // Export also saves the final deck onto the lesson (presentationStatus "exported"), so only an
  // AST that was saved/edited after the last export counts as an unexported draft.
  const hasSlideDraft = !!lesson.presentationAST && lesson.presentationStatus !== "exported";
  const quizProjects = projects.filter(p => p.type === "form" && p.isQuiz && (p.lessonId === id || p.lessonIds?.includes(id)));
  const quizDrafts = quizProjects.filter(p => p.status === "draft");
  const quizGenerated = quizProjects.filter(p => p.status === "generated" || (!p.status && p.url));
  const isMultiLesson = (p: typeof projects[0]) => Array.isArray(p.lessonIds) && p.lessonIds.length > 1;
  const typeColors = TYPE_COLORS[lesson.lessonType ?? "lesson"];
  const overviewSources = [...quizDrafts, ...quizGenerated];

  function openOverviewModal() {
    // Defaults to everything currently available, so generating with no manual changes
    // reproduces roughly today's "include everything" behavior.
    setSelectedDeckIds(new Set(decks.map(d => d.id)));
    setSelectedQuizIds(new Set(overviewSources.map(q => q.id)));
    setOverviewError("");
    setOverviewModalOpen(true);
  }

  function toggleDeckSelection(deckId: string) {
    setSelectedDeckIds(prev => {
      const next = new Set(prev);
      next.has(deckId) ? next.delete(deckId) : next.add(deckId);
      return next;
    });
  }

  function toggleQuizSelection(quizId: string) {
    setSelectedQuizIds(prev => {
      const next = new Set(prev);
      next.has(quizId) ? next.delete(quizId) : next.add(quizId);
      return next;
    });
  }

  async function handleGenerateOverview() {
    setGeneratingOverview(true);
    setOverviewError("");
    try {
      const res = await fetch(`/api/lessons/${id}/overview-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckIds: Array.from(selectedDeckIds), quizIds: Array.from(selectedQuizIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate the Overview Doc.");
      setLesson(prev => prev ? { ...prev, overviewUrl: data.url } : prev);
      setOverviewModalOpen(false);
    } catch (err: any) {
      setOverviewError(err.message || "Failed to generate the Overview Doc.");
    } finally {
      setGeneratingOverview(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <button onClick={() => router.push(backHref)} className="text-sm text-[var(--accent-text)] hover:underline mb-3 block">
          ← {lesson.courseId ? "Back to Course" : "Back to Lessons"}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {/* Course assignment badge / dropdown */}
              <div className="relative">
                <button
                  onClick={() => setAssigningCourse(v => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg transition hover:opacity-80"
                  style={course
                    ? { background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }
                    : { background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px dashed var(--border)" }
                  }
                >
                  {course ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                      {course.title}
                    </>
                  ) : "Unassigned"}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {assigningCourse && (
                  <>
                  <div className="fixed inset-0 z-20" onClick={() => setAssigningCourse(false)} />
                  <div className="absolute left-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[200px] max-w-[calc(100vw-2rem)]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                    <button
                      onClick={() => handleAssignCourse(null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                      style={{ color: !lesson.courseId ? "var(--accent-purple)" : "var(--text-muted)", fontWeight: !lesson.courseId ? 600 : 400 }}
                    >
                      {!lesson.courseId ? "✓ " : ""}No course
                    </button>
                    {allCourses.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleAssignCourse(c.id)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                        style={{ color: lesson.courseId === c.id ? "var(--accent-purple)" : "var(--text-primary)", fontWeight: lesson.courseId === c.id ? 600 : 400 }}
                      >
                        {lesson.courseId === c.id ? "✓ " : ""}{c.title}
                      </button>
                    ))}
                  </div>
                  </>
                )}
              </div>
              {currentModule && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
                  {currentModule.title}
                </span>
              )}
              {lesson.lessonType && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg capitalize" style={{ background: typeColors.bg, color: typeColors.text }}>
                  {lesson.lessonType}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold leading-snug" style={{ color: "var(--text-primary)" }}>{lesson.title}</h1>
            {lesson.subtitle && <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{lesson.subtitle}</p>}
            {lesson.topics && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{lesson.topics}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2 shrink-0">
            {/* Section text for quizzes and the Overview Doc; slides are edited in Notes to Slides. */}
            <Link
              href={`/lessons/${id}/edit`}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Edit Content
            </Link>
            <button
              onClick={startEditMeta}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Edit Info
            </button>
          </div>
        </div>
      </div>

      {/* ── Edit Metadata Modal ──────────────────────────────────────────── */}
      {editingMeta && (
        <Dialog open onClose={() => setEditingMeta(false)} labelledBy="edit-lesson-info-title" className="max-w-md">
          <div className="relative w-full max-w-md rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-float)" }}>
            <h2 id="edit-lesson-info-title" className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Lesson Info</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="lessons-id-title-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Title {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}</label>
                <input id="lessons-id-title-used-by-ai" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className={inputClass} style={inputStyle} placeholder="Lesson title" />
              </div>
              <div>
                <label htmlFor="lessons-id-subtitle-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subtitle {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}</label>
                <input id="lessons-id-subtitle-used-by-ai" value={metaSubtitle} onChange={e => setMetaSubtitle(e.target.value)} className={inputClass} style={inputStyle} placeholder="Topic or subject" />
              </div>
              <div>
                <label htmlFor="lessons-id-topics-used-by-ai" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Topics {hasAiKey && <span className="font-normal text-[10px]" style={{ color: "var(--accent-text)" }}>· used by AI</span>}
                </label>
                <input id="lessons-id-topics-used-by-ai" value={metaTopics} onChange={e => setMetaTopics(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. Claims, Evidence, Counterarguments" />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Comma-separated. AI uses these to generate slide content, overviews, and quizzes.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lessons-id-deadline" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline</label>
                  <input id="lessons-id-deadline" type="date" value={metaDeadline} onChange={e => setMetaDeadline(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="lessons-id-type" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Type</label>
                  <select id="lessons-id-type" value={metaType} onChange={e => setMetaType(e.target.value)} className={inputClass} style={inputStyle}>
                    <option value="lesson">Lesson</option>
                    <option value="practice">Practice</option>
                    <option value="project">Project</option>
                    <option value="assessment">Assessment</option>
                    <option value="review">Review</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingMeta(false)} className="flex-1 rounded-full py-2 text-sm font-semibold transition" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                Cancel
              </button>
              <button onClick={saveMeta} disabled={savingMeta || !metaTitle.trim()} className="flex-1 rounded-full bg-[#0cc0df] py-2 text-sm font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition">
                {savingMeta ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Generate Overview Doc Modal ─────────────────────────────────── */}
      {overviewModalOpen && (
        <Dialog open onClose={() => setOverviewModalOpen(false)} labelledBy="overview-doc-title" className="max-w-md">
          <div className="relative w-full max-w-md rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-float)" }}>
            <div>
              <h2 id="overview-doc-title" className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Generate Overview Doc</h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Pick which decks and quizzes it summarizes. Regenerating always replaces the existing Overview Doc.
              </p>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Slide Decks</p>
                {decks.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No decks generated for this lesson yet.</p>
                ) : (
                  <div className="space-y-1">
                    {decks.map(d => (
                      <label key={d.id} className="flex items-center gap-2.5 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                        <input type="checkbox" checked={selectedDeckIds.has(d.id)} onChange={() => toggleDeckSelection(d.id)} className="accent-[#0cc0df] w-3.5 h-3.5" />
                        {d.title}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Quizzes</p>
                {overviewSources.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No quizzes for this lesson yet.</p>
                ) : (
                  <div className="space-y-1">
                    {overviewSources.map(q => (
                      <label key={q.id} className="flex items-center gap-2.5 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                        <input type="checkbox" checked={selectedQuizIds.has(q.id)} onChange={() => toggleQuizSelection(q.id)} className="accent-[#0cc0df] w-3.5 h-3.5" />
                        {q.title} {q.status === "draft" && <span style={{ color: "var(--text-muted)" }}>(draft)</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {overviewError && <p role="alert" className="text-xs text-[var(--danger-text)]">{overviewError}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setOverviewModalOpen(false)} className="flex-1 rounded-full py-2 text-sm font-semibold transition" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                Cancel
              </button>
              <button
                onClick={handleGenerateOverview}
                disabled={generatingOverview || (selectedDeckIds.size === 0 && selectedQuizIds.size === 0)}
                className="flex-1 rounded-full bg-[#0cc0df] py-2 text-sm font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
              >
                {generatingOverview ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Documents ───────────────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Documents</p>
          <div className="flex items-center gap-3">
            {lesson.folderUrl && (
              <a href={lesson.folderUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
                Open in Drive ↗
              </a>
            )}
            <Link href="/quizzes" className="text-[10px] font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
              View All Quizzes →
            </Link>
          </div>
        </div>
        <div className="space-y-2">
          {decks.map(d => (
            <DocRow key={d.id} icon={RESOURCE_ICON.slides} color="var(--accent-purple)"
              label={d.title}
              // Deck titles now come from the lesson's own Title/Subtitle (see autoDeckName in
              // lib/google.ts), so multiple decks for the same lesson can share an identical
              // title — the generation date here is what still tells them apart.
              sublabel={`${d.presentationAST ? "Notes to Slides" : "Classic Slides (retired)"} · ${new Date(d.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
              badge="Generated" badgeColor="#2dd4a0"
              url={d.url}
              // Every deck is edited in Notes to Slides. This opens the lesson's *current* draft,
              // not necessarily this deck's own snapshot; an old Classic deck's lesson can be
              // loaded there with "Start from this lesson's content".
              editHref={`/ingest?lessonId=${id}`}
              editLabel="Edit Slides"
              onDelete={() => handleDeleteProject(d.id, d.title)}
              onRename={newTitle => handleRenameProject(d.id, newTitle)} />
          ))}
          {hasSlideDraft && (
            <DocRow icon={RESOURCE_ICON.slides} color="#ff8c4a" label="Slide Deck"
              sublabel={`${lesson.presentationAST!.slides.length} slide${lesson.presentationAST!.slides.length !== 1 ? "s" : ""} · Notes to Slides draft, not yet exported`}
              badge="Draft" badgeColor="#ff8c4a"
              editHref={`/ingest?lessonId=${id}`} editLabel="Edit Draft →"
              onDelete={handleDeleteSlideDraft} />
          )}
          {decks.length === 0 && !hasSlideDraft && (
            <DocRow icon={RESOURCE_ICON.slides} color="var(--text-muted)" label="Slide Deck" badge="Not generated" badgeColor="var(--text-muted)" editHref={`/ingest?lessonId=${id}`} editLabel="Create Slides →" />
          )}
          {lesson.overviewUrl ? (
            <DocRow icon={RESOURCE_ICON.doc} color="#0cc0df" label="Overview Doc" badge="Generated" badgeColor="#2dd4a0" url={lesson.overviewUrl}
              onAction={openOverviewModal} actionLabel="Regenerate" />
          ) : (
            <DocRow icon={RESOURCE_ICON.doc} color="var(--text-muted)" label="Overview Doc" badge="Not generated" badgeColor="var(--text-muted)"
              onAction={openOverviewModal} actionLabel="Generate" />
          )}
          {quizDrafts.map(q => (
            <DocRow key={q.id} icon={RESOURCE_ICON.form} color="#ff8c4a"
              label={q.title}
              sublabel={isMultiLesson(q) ? `Covers ${q.lessonIds!.length} lessons` : "This lesson only"}
              badge="Quiz Draft" badgeColor="#ff8c4a"
              editHref={`/quizzes/${q.id}`} editLabel={isMultiLesson(q) ? "Edit & Generate" : "Edit Quiz"}
              onDelete={() => handleDeleteProject(q.id, q.title)}
              onRename={newTitle => handleRenameProject(q.id, newTitle)} />
          ))}
          {quizGenerated.map(q => (
            <DocRow key={q.id} icon={RESOURCE_ICON.form} color="#ff8c4a"
              label={q.title}
              sublabel={isMultiLesson(q) ? `Covers ${q.lessonIds!.length} lessons` : "This lesson only"}
              badge="Quiz" badgeColor="#2dd4a0"
              url={q.url} editHref={`/quizzes/${q.id}`} editLabel="Edit Quiz"
              onDelete={() => handleDeleteProject(q.id, q.title)}
              onRename={newTitle => handleRenameProject(q.id, newTitle)} />
          ))}
          {decks.length === 0 && !hasSlideDraft && quizProjects.length === 0 && !lesson.overviewUrl && (
            <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No documents generated yet — use the Generate panel below.</p>
          )}
        </div>
      </div>

      {/* ── Generate + Resources widgets ─────────────────────────────────── */}
      <DndContext sensors={hubSensors} collisionDetection={closestCenter} onDragEnd={handleHubDragEnd}>
        <SortableContext items={hubOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {hubOrder.map(wid => (
              <SortableHubWidget key={wid} widgetId={wid} span={hubSizes[wid]} onCycleSize={() => cycleHubSize(wid)}>
                {wid === "generate" && (
                  <div className={cardClass} style={cardStyle}>
                    <p className={sectionLabel}>Generate</p>
                    <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>
                      Build this lesson&apos;s slides in Notes to Slides. Exported decks use the course template and are saved to this lesson&apos;s Drive folder.
                    </p>
                    <div className={`flex flex-col gap-2 ${hubSizes["generate"] >= 2 ? "sm:flex-row sm:flex-wrap" : ""}`}>
                      <Link
                        href={`/ingest?lessonId=${id}`}
                        className="w-full sm:w-auto text-center rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-bold text-[#0a0b13] hover:opacity-90 transition shadow"
                      >
                        {decks.length > 0 || hasSlideDraft ? "Edit Slides →" : "Create Slides →"}
                      </Link>
                      <Link
                        href={quizDrafts.length > 0 ? `/quizzes/${quizDrafts[0].id}` : `/quizzes/new?lessonId=${id}`}
                        className="w-full sm:w-auto text-center rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-80"
                        style={{ background: "rgba(12,192,223,0.12)", border: "1px solid rgba(12,192,223,0.35)", color: "var(--accent-text)" }}
                      >
                        {quizDrafts.length > 0 ? "Finish Quiz Draft →" : "Create a Quiz →"}
                      </Link>
                      {lesson.folderUrl && (
                        <a
                          href={lesson.folderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto text-center rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-80"
                          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)", color: "var(--accent-purple)" }}
                        >
                          Open Drive Folder ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {wid === "resources" && (
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Resources</p>
          <div className="relative">
            <button
              onClick={() => setAddResourceOpen(v => !v)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              + Add
            </button>
            {addResourceOpen && (
              <>
              <div className="fixed inset-0 z-20" onClick={() => setAddResourceOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[160px] max-w-[calc(100vw-2rem)]"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}
              >
                <button
                  onClick={() => { setAddingBlankDoc(true); setAddingLink(false); setAddResourceOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition"
                  style={{ color: "var(--text-primary)" }}
                >
                  Create Google Doc
                </button>
                <button
                  onClick={() => { setAddingLink(true); setAddingBlankDoc(false); setAddResourceOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition"
                  style={{ color: "var(--text-primary)" }}
                >
                  Add Link
                </button>
              </div>
              </>
            )}
          </div>
        </div>

        {/* Create blank doc form */}
        {addingBlankDoc && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Create blank Google document</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lessons-id-name" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Name</label>
                <input id="lessons-id-name" value={blankDocName} onChange={e => setBlankDocName(e.target.value)} placeholder="Document name" className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
              <div>
                <label htmlFor="lessons-id-type-2" className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Type</label>
                <select id="lessons-id-type-2" value={blankDocType} onChange={e => setBlankDocType(e.target.value as "doc" | "sheet" | "slides")} className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <option value="doc">Google Doc</option>
                  <option value="sheet">Google Sheet</option>
                  <option value="slides">Google Slides</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddingBlankDoc(false)} className="rounded-full px-3 py-1.5 text-xs font-semibold transition" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleCreateBlankDoc} disabled={savingBlankDoc || !blankDocName.trim()} className="rounded-full bg-[#0cc0df] px-4 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition">
                {savingBlankDoc ? "Creating…" : "Create in Drive"}
              </button>
            </div>
          </div>
        )}

        {/* Add link form */}
        {addingLink && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Attach a link</p>
            <div className="space-y-2">
              <input aria-label="Link label" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Label (e.g. Module 1 Textbook)" className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <input aria-label="Link URL" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <select aria-label="Link type" value={linkType} onChange={e => setLinkType(e.target.value as LessonResource["type"])} className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <option value="link">Link</option>
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
                <option value="doc">Google Doc</option>
                <option value="sheet">Google Sheet</option>
                <option value="slides">Google Slides</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddingLink(false)} className="rounded-full px-3 py-1.5 text-xs font-semibold transition" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleAddLink} disabled={savingLink || !linkLabel.trim() || !linkUrl.trim()} className="rounded-full bg-[#0cc0df] px-4 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition">
                {savingLink ? "Saving…" : "Attach"}
              </button>
            </div>
          </div>
        )}

        {/* Resource list */}
        {(lesson.resources ?? []).length === 0 && !addingLink && !addingBlankDoc ? (
          <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
            No resources attached yet. Create a blank doc or add a link.
          </p>
        ) : (
          <div className="space-y-2">
            {(lesson.resources ?? []).map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
                <span style={{ color: RESOURCE_COLOR[r.type] }}>{RESOURCE_ICON[r.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{r.label}</p>
                  <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{r.url}</p>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold shrink-0 hover:underline" style={{ color: "var(--accent-text)" }}>Open ↗</a>
                <button aria-label={`Remove ${r.label}`} onClick={() => handleDeleteResource(r.id)} className="p-1 rounded-full shrink-0 hover:text-[var(--danger-text)] transition" style={{ color: "var(--text-muted)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
                )}
              </SortableHubWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {lesson.notes && (
        <div className={cardClass} style={cardStyle}>
          <p className={sectionLabel}>Instructor Notes</p>
          <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{lesson.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Helper component ──────────────────────────────────────────────────────────

function DocRow({ icon, color, label, sublabel, badge, badgeColor, url, editHref, editLabel, onAction, actionLabel, onDelete, onRename }: {
  icon: React.ReactNode;
  color: string;
  label: string;
  sublabel?: string;
  badge: string;
  badgeColor: string;
  url?: string;
  editHref?: string;
  editLabel?: string;
  onAction?: () => void;
  actionLabel?: string;
  onDelete?: () => void;
  onRename?: (newTitle: string) => Promise<boolean>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);

  function startRenaming() {
    setDraftLabel(label);
    setRenaming(true);
  }

  async function commitRename() {
    setRenaming(false);
    if (draftLabel.trim() === label.trim() || !draftLabel.trim()) return;
    const ok = await onRename!(draftLabel);
    if (!ok) setDraftLabel(label); // revert display value on failure — parent state stays untouched either way
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
      <span style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input aria-label="Resource name"
            autoFocus
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setDraftLabel(label); setRenaming(false); }
            }}
            className="w-full text-xs font-semibold bg-transparent border-b"
            style={{ color: "var(--text-primary)", borderColor: "var(--accent)" }}
          />
        ) : (
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{label}</p>
            {onRename && (
              <button
                type="button"
                onClick={startRenaming}
                title="Rename"
                className="p-0.5 rounded shrink-0 transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            )}
          </div>
        )}
        {sublabel && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{sublabel}</p>}
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: badgeColor + "20", color: badgeColor }}>
        {badge}
      </span>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0 transition hover:opacity-80"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          {actionLabel}
        </button>
      )}
      {editHref && (
        <Link
          href={editHref}
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0 transition hover:opacity-80"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          {editLabel ?? "Edit →"}
        </Link>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold shrink-0 hover:underline" style={{ color: "var(--accent-text)" }}>
          Open ↗
        </a>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="p-1 rounded-full transition hover:text-[var(--danger-text)] hover:bg-red-500/10 shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      )}
    </div>
  );
}
