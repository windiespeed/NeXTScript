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
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";
const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  lesson:     { bg: "rgba(12,192,223,0.12)",  text: "#0cc0df" },
  practice:   { bg: "var(--accent-purple-bg)", text: "var(--accent-purple)" },
  project:    { bg: "rgba(255,140,74,0.12)",  text: "#ff8c4a" },
  assessment: { bg: "rgba(45,212,160,0.12)",  text: "#2dd4a0" },
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
      <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover/widget:opacity-100 transition-opacity flex items-center gap-1">
        <div
          {...listeners}
          {...attributes}
          title="Drag to reorder"
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

  // Generate state
  const [genSlides, setGenSlides] = useState(true);
  const [genOverview, setGenOverview] = useState(true);
  const [genQuiz, setGenQuiz] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

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

  // Widget order + sizes
  const [hubOrder, setHubOrder] = useState<HubWidgetId[]>(DEFAULT_HUB_ORDER);
  const [hubSizes, setHubSizes] = useState<Record<HubWidgetId, 1 | 2>>(DEFAULT_HUB_SIZES);
  const hubSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      fetch(`/api/lessons/${id}`).then(r => r.json()),
      fetch("/api/projects").then(r => r.json()),
      fetch("/api/drive").then(r => r.json()),
    ]).then(([lessonData, projectData, coursesData]) => {
      setAllCourses(Array.isArray(coursesData) ? coursesData : []);
      setLesson(lessonData);
      setProjects(Array.isArray(projectData) ? projectData : []);
      // Set quiz checkbox on if drafts exist for this lesson
      const hasDraft = (Array.isArray(projectData) ? projectData : []).some(
        (p: SavedProject) => p.type === "form" && p.status === "draft" && (p.lessonId === id || p.lessonIds?.includes(id))
      );
      if (hasDraft) setGenQuiz(true);

      if (lessonData?.courseId) {
        fetch(`/api/drive/${lessonData.courseId}`).then(r => r.json()).then(c => {
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

  async function handleGenerate() {
    const files: string[] = [];
    if (genSlides) files.push("slides");
    if (genOverview) files.push("doc");
    if (genQuiz) files.push("quiz");
    if (files.length === 0) { setGenerateError("Select at least one item to generate."); return; }

    setGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch(`/api/generate/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, destination: "drive" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setLesson(prev => prev ? { ...prev, ...data } : prev);
      // Refresh projects to pick up newly created deck/quiz
      fetch("/api/projects").then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []));
    } catch (err: any) {
      setGenerateError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
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
        await fetch(`/api/drive/${oldCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: oldCourse.lessonIds.filter(lid => lid !== id) }),
        });
      }
    }

    if (newCourseId) {
      const newCourse = allCourses.find(c => c.id === newCourseId);
      if (newCourse && !newCourse.lessonIds.includes(id)) {
        await fetch(`/api/drive/${newCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonIds: [...newCourse.lessonIds, id] }),
        });
      }
      const fetchedCourse = await fetch(`/api/drive/${newCourseId}`).then(r => r.json());
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

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading…</p>;
  if (!lesson) return <p className="text-sm text-red-500 mt-10">Lesson not found.</p>;

  const currentModule = courseModules.find(m => m.lessonIds.includes(id));
  const backHref = lesson.courseId ? `/courses/${lesson.courseId}` : "/slides";

  const deck = projects.find(p => p.type === "deck" && (p.lessonId === id || p.lessonIds?.includes(id)));
  const quizProjects = projects.filter(p => p.type === "form" && p.isQuiz && (p.lessonId === id || p.lessonIds?.includes(id)));
  const quizDrafts = quizProjects.filter(p => p.status === "draft");
  const quizGenerated = quizProjects.filter(p => p.status === "generated" || (!p.status && p.url));
  const typeColors = TYPE_COLORS[lesson.lessonType ?? "lesson"];

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <button onClick={() => router.push(backHref)} className="text-sm text-[#0cc0df] hover:underline mb-3 block">
          ← {lesson.courseId ? "Back to Course" : "Back to Slides"}
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
                  <div className="absolute left-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[200px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
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
          <button
            onClick={startEditMeta}
            className="rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 transition hover:bg-[var(--bg-card-hover)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Edit Info
          </button>
        </div>
      </div>

      {/* ── Edit Metadata Modal ──────────────────────────────────────────── */}
      {editingMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingMeta(false)} />
          <div className="relative w-full max-w-md rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-float)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Lesson Info</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Title</label>
                <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className={inputClass} style={inputStyle} placeholder="Lesson title" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subtitle</label>
                <input value={metaSubtitle} onChange={e => setMetaSubtitle(e.target.value)} className={inputClass} style={inputStyle} placeholder="Topic or subject" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Topics</label>
                <input value={metaTopics} onChange={e => setMetaTopics(e.target.value)} className={inputClass} style={inputStyle} placeholder="Comma-separated topics" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline</label>
                  <input type="date" value={metaDeadline} onChange={e => setMetaDeadline(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Type</label>
                  <select value={metaType} onChange={e => setMetaType(e.target.value)} className={inputClass} style={inputStyle}>
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
        </div>
      )}

      {/* ── Documents ───────────────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Documents</p>
        <div className="space-y-2">
          {deck ? (
            <DocRow icon={RESOURCE_ICON.slides} color="var(--accent-purple)" label="Slide Deck" badge="Generated" badgeColor="#2dd4a0" url={deck.url} editHref={`/slides/${id}`} editLabel="Edit Slides" />
          ) : (
            <DocRow icon={RESOURCE_ICON.slides} color="var(--text-muted)" label="Slide Deck" badge="Not generated" badgeColor="var(--text-muted)" editHref={`/slides/${id}`} editLabel="Edit Slides" />
          )}
          {lesson.overviewUrl ? (
            <DocRow icon={RESOURCE_ICON.doc} color="#0cc0df" label="Overview Doc" badge="Generated" badgeColor="#2dd4a0" url={lesson.overviewUrl} />
          ) : (
            <DocRow icon={RESOURCE_ICON.doc} color="var(--text-muted)" label="Overview Doc" badge="Not generated" badgeColor="var(--text-muted)" />
          )}
          {quizDrafts.map(q => (
            <DocRow key={q.id} icon={RESOURCE_ICON.form} color="#ff8c4a" label={q.title} badge="Quiz Draft" badgeColor="#ff8c4a" editHref={`/quizzes/${q.id}`} editLabel="Edit Quiz" />
          ))}
          {quizGenerated.map(q => (
            <DocRow key={q.id} icon={RESOURCE_ICON.form} color="#ff8c4a" label={q.title} badge="Quiz" badgeColor="#2dd4a0" url={q.url} />
          ))}
          {!deck && quizProjects.length === 0 && !lesson.overviewUrl && (
            <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No documents generated yet — use the Generate panel above.</p>
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
                      Select what to generate and send to Google Drive.
                    </p>
                    {/* span=2: pills + buttons inline on sm+; span=1: always stacked */}
                    <div className={`flex flex-col gap-2 ${hubSizes["generate"] >= 2 ? "sm:flex-row sm:flex-wrap sm:items-center" : ""}`}>
                      <div className={`flex flex-wrap gap-2 ${hubSizes["generate"] >= 2 ? "justify-center sm:justify-start sm:flex-1" : "justify-center"}`}>
                        {([
                          { key: "slides", label: "Slide Deck", state: genSlides, set: setGenSlides },
                          { key: "overview", label: "Overview Doc", state: genOverview, set: setGenOverview },
                          { key: "quiz", label: `Quiz${quizDrafts.length > 0 ? ` (${quizDrafts.length} draft${quizDrafts.length > 1 ? "s" : ""})` : ""}`, state: genQuiz, set: setGenQuiz },
                        ] as const).map(({ key, label, state, set }) => (
                          <button
                            key={key}
                            onClick={() => set(!state)}
                            className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                            style={state
                              ? { background: "#0cc0df", color: "#0a0b13" }
                              : { background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className={`flex flex-col gap-2 ${hubSizes["generate"] >= 2 ? "sm:flex-row sm:shrink-0" : ""}`}>
                        <button
                          onClick={handleGenerate}
                          disabled={generating || (!genSlides && !genOverview && !genQuiz)}
                          className="w-full sm:w-auto rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
                        >
                          {generating ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                              Generating…
                            </span>
                          ) : "Generate to Drive"}
                        </button>
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
                    {generateError && <p className="text-xs text-red-500">{generateError}</p>}
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
                className="absolute right-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[160px]"
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
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Name</label>
                <input value={blankDocName} onChange={e => setBlankDocName(e.target.value)} placeholder="Document name" className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Type</label>
                <select value={blankDocType} onChange={e => setBlankDocType(e.target.value as "doc" | "sheet" | "slides")} className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
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
              <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Label (e.g. Module 1 Textbook)" className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <select value={linkType} onChange={e => setLinkType(e.target.value as LessonResource["type"])} className={inputClass} style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
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
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold shrink-0 hover:underline" style={{ color: "#0cc0df" }}>Open ↗</a>
                <button onClick={() => handleDeleteResource(r.id)} className="p-1 rounded-full shrink-0 hover:text-red-500 transition" style={{ color: "var(--text-muted)" }}>
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

function DocRow({ icon, color, label, badge, badgeColor, url, editHref, editLabel }: {
  icon: React.ReactNode;
  color: string;
  label: string;
  badge: string;
  badgeColor: string;
  url?: string;
  editHref?: string;
  editLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
      <span style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{label}</p>
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: badgeColor + "20", color: badgeColor }}>
        {badge}
      </span>
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
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold shrink-0 hover:underline" style={{ color: "#0cc0df" }}>
          Open ↗
        </a>
      )}
    </div>
  );
}
