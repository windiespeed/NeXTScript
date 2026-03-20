"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Course, CourseSettings, CourseResource } from "@/types/course";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";
import GenerateModal from "@/components/GenerateModal";
type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";


const SECTION_LABEL_KEYS = [
  { key: "warmUp",                label: "Opening Activity" },
  { key: "guidedLab",             label: "Guided Activity" },
  { key: "selfPaced",             label: "Independent Activity" },
  { key: "submissionChecklist",   label: "Requirements Checklist" },
  { key: "checkpoint",            label: "Common Problems / FAQ" },
  { key: "industryBestPractices", label: "Best Practices" },
  { key: "devJournalPrompt",      label: "Reflection Journal" },
  { key: "rubric",                label: "Assessment / Rubric" },
] as const;

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

const STATUS_COLOR: Record<Lesson["status"], string> = {
  draft:        "bg-[var(--text-muted)]",
  generating:   "bg-[#ff8c4a] animate-pulse",
  regenerating: "bg-[#0cc0df] animate-pulse",
  done:         "bg-[#2dd4a0]",
  error:        "bg-red-500",
};

const STATUS_LABEL: Record<Lesson["status"], string> = {
  draft: "Draft", generating: "Generating…", regenerating: "Regenerating…", done: "Done", error: "Error",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CourseDetailPage() {
  useSession({ required: true });
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [editSettings, setEditSettings] = useState<CourseSettings>(DEFAULT_COURSE_SETTINGS);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGradeLevel, setEditGradeLevel] = useState("");
  const [editTerm, setEditTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [generateLesson, setGenerateLesson] = useState<Lesson | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicating, setDuplicating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [toAdd, setToAdd] = useState<Set<string>>(new Set());
  const [addingExisting, setAddingExisting] = useState(false);
  const [movingLessonId, setMovingLessonId] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<import("@/types/course").Course[]>([]);
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [newResourceLabel, setNewResourceLabel] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${id}`).then((r) => r.json()),
      fetch(`/api/lessons?courseId=${id}`).then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/courses").then((r) => r.json()),
    ]).then(([courseData, lessonData, projectData, coursesData]) => {
      if (!courseData?.id) { setLoading(false); return; }
      setCourse(courseData);
      setEditTitle(courseData.title ?? "");
      setEditDescription(courseData.description ?? "");
      setEditGradeLevel(courseData.gradeLevel ?? "");
      setEditTerm(courseData.term ?? "");
      setEditSettings({ ...DEFAULT_COURSE_SETTINGS, ...(courseData.settings ?? {}) });
      setProjects(Array.isArray(projectData) ? projectData : []);
      setLessons(Array.isArray(lessonData) ? lessonData : []);
      setAllCourses(Array.isArray(coursesData) ? coursesData : []);
      setResources(Array.isArray(courseData.resources) ? courseData.resources : []);
      setLoading(false);
    });
  }, [id]);

  function patchSettings(patch: Partial<CourseSettings>) {
    setEditSettings((prev) => ({ ...prev, ...patch }));
  }

  function patchSectionLabel(key: string, value: string) {
    setEditSettings((prev) => ({
      ...prev,
      sectionLabels: { ...prev.sectionLabels, [key]: value },
    }));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    const res = await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        gradeLevel: editGradeLevel,
        term: editTerm,
        settings: editSettings,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setCourse(updated);
      setSaveMsg("Settings saved.");
      setTimeout(() => { setSaveMsg(""); setSettingsOpen(false); }, 1500);
    }
  }

  async function handleToggleReleased(lesson: Lesson) {
    const updated = { ...lesson, released: !lesson.released };
    setLessons((prev) => prev.map((l) => l.id === lesson.id ? updated : l));
    await fetch(`/api/lessons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released: !lesson.released }),
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/courses/${id}/student`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleBulkRelease(release: boolean) {
    const targets = lessons.filter(l => l.released !== release);
    setLessons(prev => prev.map(l => ({ ...l, released: release })));
    await Promise.all(targets.map(l =>
      fetch(`/api/lessons/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ released: release }),
      })
    ));
  }

  function toggleSelect(lessonId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(lessonId) ? next.delete(lessonId) : next.add(lessonId);
      return next;
    });
  }

  async function duplicateLesson(lesson: Lesson): Promise<Lesson | null> {
    const full = await fetch(`/api/lessons/${lesson.id}`).then(r => r.json());
    const body = {
      title: `Copy of ${full.title}`,
      topics: full.topics ?? "",
      deadline: full.deadline ?? "",
      tag: full.tag ?? "",
      subtitle: full.subtitle ?? "",
      overview: full.overview ?? "",
      learningTargets: full.learningTargets ?? "",
      vocabulary: full.vocabulary ?? "",
      warmUp: full.warmUp ?? "",
      slideContent: full.slideContent ?? "",
      guidedLab: full.guidedLab ?? "",
      selfPaced: full.selfPaced ?? "",
      submissionChecklist: full.submissionChecklist ?? "",
      checkpoint: full.checkpoint ?? "",
      industryBestPractices: full.industryBestPractices ?? "",
      devJournalPrompt: full.devJournalPrompt ?? "",
      rubric: full.rubric ?? "",
      sources: full.sources ?? "",
      studentLevel: full.studentLevel,
      quizQuestions: full.quizQuestions,
      courseId: id,
      released: false,
      folder: full.folder ?? "",
    };
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const copy = await res.json();
    // Add to course lessonIds
    await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: [...(course?.lessonIds ?? []), copy.id] }),
    });
    return copy;
  }

  async function handleDuplicateLesson(lesson: Lesson) {
    const copy = await duplicateLesson(lesson);
    if (copy) {
      setLessons(prev => [...prev, copy]);
      setCourse(prev => prev ? { ...prev, lessonIds: [...prev.lessonIds, copy.id] } : prev);
    }
  }

  async function handleBulkDuplicate() {
    if (selectedIds.size === 0) return;
    setDuplicating(true);
    const targets = lessons.filter(l => selectedIds.has(l.id));
    const copies = await Promise.all(targets.map(duplicateLesson));
    const valid = copies.filter(Boolean) as Lesson[];
    if (valid.length) {
      setLessons(prev => [...prev, ...valid]);
      setCourse(prev => prev ? { ...prev, lessonIds: [...prev.lessonIds, ...valid.map(c => c.id)] } : prev);
    }
    setSelectedIds(new Set());
    setSelecting(false);
    setDuplicating(false);
  }

  async function handleGenerate(lessonId: string, files: FileChoice[], destination: Destination, templateId?: string) {
    const lesson = lessons.find(l => l.id === lessonId);
    const inProgressStatus = lesson?.status === "done" ? "regenerating" : "generating";
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: inProgressStatus } : l));
    setGenerateLesson(null);
    const res = await fetch(`/api/generate/${lessonId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files, destination, templateId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: "error", errorMessage: data.error } : l));
      return;
    }
    const data = await res.json();
    if (destination === "drive") {
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, ...data } : l));
    } else {
      for (const file of data.downloads ?? []) {
        const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.filename });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: "done" } : l));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} lesson${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    await Promise.all(ids.map(lid => fetch(`/api/lessons/${lid}`, { method: "DELETE" })));
    setLessons(prev => prev.filter(l => !selectedIds.has(l.id)));
    setCourse(prev => prev ? { ...prev, lessonIds: prev.lessonIds.filter(l => !selectedIds.has(l)) } : prev);
    setSelectedIds(new Set());
    setSelecting(false);
    setBulkDeleting(false);
  }

  async function openAddExisting() {
    const data = await fetch("/api/lessons").then(r => r.json());
    setAllLessons(Array.isArray(data) ? data.filter((l: Lesson) => l.id !== id && !lessons.some(cl => cl.id === l.id)) : []);
    setToAdd(new Set());
    setAddExistingOpen(true);
  }

  async function handleAddExisting() {
    if (toAdd.size === 0) return;
    setAddingExisting(true);
    const toLessons = allLessons.filter(l => toAdd.has(l.id));
    for (const lesson of toLessons) {
      // Remove from old course if needed
      if (lesson.courseId && lesson.courseId !== id) {
        const oldCourse = allCourses.find(c => c.id === lesson.courseId);
        if (oldCourse) {
          await fetch(`/api/courses/${lesson.courseId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonIds: oldCourse.lessonIds.filter(lid => lid !== lesson.id) }),
          });
        }
      }
      await fetch(`/api/lessons/${lesson.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: id }),
      });
    }
    await fetch(`/api/courses/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: [...(course?.lessonIds ?? []), ...toLessons.map(l => l.id)] }),
    });
    const added = toLessons.map(l => ({ ...l, courseId: id }));
    setLessons(prev => [...prev, ...added]);
    setCourse(prev => prev ? { ...prev, lessonIds: [...prev.lessonIds, ...added.map(l => l.id)] } : prev);
    setAddExistingOpen(false);
    setAddingExisting(false);
  }

  async function handleMoveLesson(lessonId: string, newCourseId: string) {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    // Remove from this course
    await fetch(`/api/courses/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: course!.lessonIds.filter(l => l !== lessonId) }),
    });
    // Add to new course
    const newCourse = allCourses.find(c => c.id === newCourseId);
    if (newCourse) {
      await fetch(`/api/courses/${newCourseId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonIds: [...newCourse.lessonIds, lessonId] }),
      });
    }
    await fetch(`/api/lessons/${lessonId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: newCourseId }),
    });
    setLessons(prev => prev.filter(l => l.id !== lessonId));
    setCourse(prev => prev ? { ...prev, lessonIds: prev.lessonIds.filter(l => l !== lessonId) } : prev);
    setMovingLessonId(null);
  }

  async function handleRemoveLesson(lessonId: string) {
    if (!confirm("Remove this lesson from the course? The lesson itself won't be deleted.")) return;
    await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: course!.lessonIds.filter((l) => l !== lessonId) }),
    });
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
    setCourse((prev) => prev ? { ...prev, lessonIds: prev.lessonIds.filter((l) => l !== lessonId) } : prev);
  }

  async function handleCreateCourseFolder() {
    setCreatingFolder(true);
    const res = await fetch(`/api/courses/${id}/folder`, { method: "POST" });
    setCreatingFolder(false);
    if (res.ok) {
      const updated = await res.json();
      setCourse(updated);
    }
  }

  async function handleAddResource() {
    if (!newResourceLabel.trim() || !newResourceUrl.trim()) return;
    const newResource: CourseResource = { id: crypto.randomUUID(), label: newResourceLabel.trim(), url: newResourceUrl.trim() };
    const updated = [...resources, newResource];
    setResources(updated);
    setCourse(prev => prev ? { ...prev, resources: updated } : prev);
    setNewResourceLabel("");
    setNewResourceUrl("");
    setAddResourceOpen(false);
    await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resources: updated }),
    });
  }

  async function handleRemoveResource(resourceId: string) {
    const updated = resources.filter(r => r.id !== resourceId);
    setResources(updated);
    setCourse(prev => prev ? { ...prev, resources: updated } : prev);
    await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resources: updated }),
    });
  }

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading…</p>;
  if (!course) return <p className="text-sm text-red-500 mt-10">Course not found.</p>;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => router.push("/courses")} className="text-sm text-[#0cc0df] hover:underline">
        ← Back to Courses
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Course</p>
          <h1 className="text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{course.title}</h1>
          {course.description && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{course.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {course.settings?.subject && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.settings.subject}</span>
            )}
            {course.gradeLevel && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.gradeLevel}</span>
            )}
            {course.term && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.term}</span>
            )}
            {course.settings?.studentLevel && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-[#0cc0df] capitalize" style={{ background: "var(--accent-bg)" }}>{course.settings.studentLevel}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1.5">
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{lessons.length}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lessons.length === 1 ? "lesson" : "lessons"}</p>
          {lessons.length > 0 && (
            <div className="w-24">
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full bg-[#2dd4a0] transition-all duration-500"
                  style={{ width: `${Math.round((lessons.filter(l => l.released).length / lessons.length) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] mt-0.5 text-right" style={{ color: "var(--text-muted)" }}>
                {lessons.filter(l => l.released).length}/{lessons.length} released
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Drive Folder + Resources ─────────────────────────────────── */}
      <div className="rounded-3xl p-5 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Course Resources</p>
          <div className="flex items-center gap-2">
            {course.driveFolderUrl ? (
              <a
                href={course.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                style={{ background: "rgba(45,212,160,0.12)", border: "1px solid rgba(45,212,160,0.35)", color: "#2dd4a0" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Course Folder ↗
              </a>
            ) : (
              <button
                onClick={handleCreateCourseFolder}
                disabled={creatingFolder}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {creatingFolder ? "Creating…" : "Create Drive Folder"}
              </button>
            )}
            <button
              onClick={() => setAddResourceOpen(true)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--accent-bg)]"
              style={{ color: "#0cc0df" }}
            >
              + Add Resource
            </button>
          </div>
        </div>
        {resources.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No resources yet. Add Drive links, syllabi, or reference docs.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resources.map(r => (
              <div key={r.id} className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent-purple-bg)", border: "1px solid rgba(99,102,241,0.30)", color: "var(--accent-purple)" }}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.label} ↗</a>
                <button
                  onClick={() => handleRemoveResource(r.id)}
                  title="Remove"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500 leading-none"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Lessons ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} in this course
              {lessons.filter(l => l.released).length > 0 && (
                <span className="ml-2 text-[#2dd4a0]">· {lessons.filter(l => l.released).length} released</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {selecting ? (
                <>
                  <button
                    onClick={() => { setSelecting(false); setSelectedIds(new Set()); }}
                    className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDuplicate}
                    disabled={selectedIds.size === 0 || duplicating || bulkDeleting}
                    className="rounded-full bg-[#0cc0df] px-3 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {duplicating ? "Duplicating…" : `Duplicate${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0 || duplicating || bulkDeleting}
                    className="rounded-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    {bulkDeleting ? "Deleting…" : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                  </button>
                </>
              ) : (
                <>
                  {lessons.length > 0 && (
                    <>
                      <button
                        onClick={() => setSelecting(true)}
                        className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        Select
                      </button>
                      <button
                        onClick={() => handleBulkRelease(!lessons.every(l => l.released))}
                        className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        {lessons.every(l => l.released) ? "Unrelease All" : "Release All"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleCopyLink}
                    className="rounded-full px-3 py-2 text-xs font-semibold text-[#2dd4a0] hover:bg-[#2dd4a0]/10 transition"
                    style={{ border: "1px solid #2dd4a0" }}
                  >
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                  <a
                    href={`/courses/${id}/student`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full px-3 py-2 text-xs font-semibold text-[#2dd4a0] hover:bg-[#2dd4a0]/10 transition"
                    style={{ border: "1px solid #2dd4a0" }}
                  >
                    Student View ↗
                  </a>
                  <button
                    onClick={openAddExisting}
                    className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    Add Existing
                  </button>
                  <Link
                    href={`/lessons/new?courseId=${id}`}
                    className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition shadow"
                  >
                    + New Lesson
                  </Link>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    title="Course settings"
                    className="p-2 rounded-full transition hover:bg-[var(--bg-card-hover)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {lessons.length === 0 ? (
            <div className="text-center py-12 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No lessons yet.</p>
              <Link
                href={`/lessons/new?courseId=${id}`}
                className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Add first lesson
              </Link>
            </div>
          ) : (
            <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {lessons.map((lesson, i) => (
                <div
                  key={lesson.id}
                  onClick={selecting ? () => toggleSelect(lesson.id) : undefined}
                  className={`flex items-center gap-4 px-4 py-3 transition ${selecting ? "cursor-pointer" : "hover:bg-[var(--bg-card-hover)]"} ${selecting && selectedIds.has(lesson.id) ? "bg-[#0cc0df]/10" : ""}`}
                  style={{
                    background: selecting && selectedIds.has(lesson.id) ? undefined : "var(--bg-card)",
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  {selecting ? (
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${selectedIds.has(lesson.id) ? "bg-[#0cc0df] border-[#0cc0df]" : "border-[var(--border)]"}`}
                      style={selectedIds.has(lesson.id) ? {} : { background: "var(--bg-body)" }}
                    >
                      {selectedIds.has(lesson.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-[#0a0b13]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  ) : (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[lesson.status]}`} />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <p className="text-sm font-semibold truncate shrink-0" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                      {lesson.subtitle && (
                        <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{lesson.subtitle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{STATUS_LABEL[lesson.status]}</span>
                      {lesson.deadline && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Due {lesson.deadline}</span>
                      )}
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Created {fmt(lesson.createdAt)}
                        {lesson.updatedAt !== lesson.createdAt && <> · Modified {fmt(lesson.updatedAt)}</>}
                      </span>
                    </div>
                  </div>

                  {!selecting && (() => {
                    const deck = projects.find(p => p.lessonId === lesson.id && p.type === "deck");
                    const form = projects.find(p => p.lessonId === lesson.id && p.type === "form");
                    return (deck || form || lesson.folderUrl) ? (
                      <div className="flex items-center gap-1 shrink-0">
                        {deck && (
                          <Link href={`/slides?lessonId=${lesson.id}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80" style={{ background: "rgba(12,192,223,0.12)", border: "1px solid rgba(12,192,223,0.35)", color: "#0cc0df" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            Slides
                          </Link>
                        )}
                        {form && (
                          <Link href={`/forms?lessonId=${lesson.id}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80" style={{ background: "rgba(255,140,74,0.12)", border: "1px solid rgba(255,140,74,0.35)", color: "#ff8c4a" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            Quiz
                          </Link>
                        )}
                        {lesson.folderUrl && (
                          <a href={lesson.folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80" style={{ background: "rgba(45,212,160,0.12)", border: "1px solid rgba(45,212,160,0.35)", color: "#2dd4a0" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            Drive ↗
                          </a>
                        )}
                      </div>
                    ) : null;
                  })()}

                  {!selecting && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleReleased(lesson)}
                        title={lesson.released ? "Click to hide from students" : "Click to release to students"}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          lesson.released
                            ? "bg-[#2dd4a0]/15 text-[#2dd4a0] hover:bg-[#2dd4a0]/25"
                            : "hover:bg-[var(--bg-card-hover)]"
                        }`}
                        style={lesson.released ? {} : { border: "1px solid var(--border)", color: "var(--text-muted)" }}
                      >
                        {lesson.released ? "Released" : "Release"}
                      </button>
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="rounded-full bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setGenerateLesson(lesson)}
                        disabled={lesson.status === "generating" || lesson.status === "regenerating"}
                        className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                      >
                        {lesson.status === "generating" || lesson.status === "regenerating" ? "Running…" : "Generate"}
                      </button>
                      <button
                        onClick={() => handleDuplicateLesson(lesson)}
                        title="Duplicate lesson"
                        className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      {/* Move to Course */}
                      {allCourses.filter(c => c.id !== id).length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setMovingLessonId(movingLessonId === lesson.id ? null : lesson.id)}
                            title="Move to course"
                            className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                          </button>
                          {movingLessonId === lesson.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[180px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Move to…</p>
                              {allCourses.filter(c => c.id !== id).map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => handleMoveLesson(lesson.id, c.id)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {c.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveLesson(lesson.id)}
                        title="Delete lesson"
                        className="p-1.5 rounded-full transition hover:text-red-500 hover:bg-red-500/10"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      <GenerateModal
        lesson={generateLesson}
        onClose={() => setGenerateLesson(null)}
        onGenerate={handleGenerate}
      />

      {/* ── Add Existing Lesson Modal ─────────────────────────────────── */}
      {addExistingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddExistingOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-3xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-float)" }}>
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Add Existing Lessons</h2>
              <button onClick={() => setAddExistingOpen(false)} className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-muted)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {allLessons.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No other lessons available to add.</p>
              ) : (
                <div className="space-y-1">
                  {allLessons.map(l => (
                    <button
                      key={l.id}
                      onClick={() => setToAdd(prev => { const next = new Set(prev); next.has(l.id) ? next.delete(l.id) : next.add(l.id); return next; })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition hover:bg-[var(--bg-card-hover)]"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${toAdd.has(l.id) ? "bg-[#0cc0df] border-[#0cc0df]" : "border-[var(--border)]"}`}
                        style={toAdd.has(l.id) ? {} : { background: "var(--bg-body)" }}>
                        {toAdd.has(l.id) && <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-[#0a0b13]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{l.title}</p>
                        {l.courseId && (
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Currently in: {allCourses.find(c => c.id === l.courseId)?.title ?? "another course"}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex items-center gap-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={handleAddExisting}
                disabled={toAdd.size === 0 || addingExisting}
                className="rounded-full bg-[#0cc0df] px-5 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
              >
                {addingExisting ? "Adding…" : `Add${toAdd.size > 0 ? ` (${toAdd.size})` : ""}`}
              </button>
              <button onClick={() => setAddExistingOpen(false)} className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-secondary)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Resource Modal ───────────────────────────────────────── */}
      {addResourceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddResourceOpen(false)} />
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-float)" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Add Resource</h2>
              <button onClick={() => setAddResourceOpen(false)} className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-muted)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Label</label>
                <input
                  type="text"
                  value={newResourceLabel}
                  onChange={e => setNewResourceLabel(e.target.value)}
                  placeholder="e.g. Syllabus, Reference Sheet"
                  className={inputClass}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>URL</label>
                <input
                  type="url"
                  value={newResourceUrl}
                  onChange={e => setNewResourceUrl(e.target.value)}
                  placeholder="https://drive.google.com/…"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={handleAddResource}
                disabled={!newResourceLabel.trim() || !newResourceUrl.trim()}
                className="rounded-full bg-[#0cc0df] px-5 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
              >
                Add
              </button>
              <button onClick={() => setAddResourceOpen(false)} className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-secondary)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ────────────────────────────────────────────── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSettingsOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-float)" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Course Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-muted)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form onSubmit={handleSaveSettings} className="space-y-6">

          {/* Course Info */}
          <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0cc0df] mb-3">Course Info</p>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Title</label>
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Description</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className={inputClass} style={inputStyle} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Grade Level</label>
                <input type="text" value={editGradeLevel} onChange={(e) => setEditGradeLevel(e.target.value)} placeholder="e.g. 9th Grade, College" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Term</label>
                <input type="text" value={editTerm} onChange={(e) => setEditTerm(e.target.value)} placeholder="e.g. Spring 2026" className={inputClass} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Generation Settings */}
          <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0cc0df] mb-1">Generation Settings</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>These override your global profile settings for every lesson in this course.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Industry</label>
                <input type="text" value={editSettings.industry} onChange={(e) => patchSettings({ industry: e.target.value })} placeholder="e.g. Coding, Healthcare" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subject Area</label>
                <input type="text" value={editSettings.subject} onChange={(e) => patchSettings({ subject: e.target.value })} placeholder="e.g. JavaScript, Nursing 101" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Student Level</label>
              <select value={editSettings.studentLevel} onChange={(e) => patchSettings({ studentLevel: e.target.value as CourseSettings["studentLevel"] })} className={inputClass} style={inputStyle}>
                <option value="">— Not specified —</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Default Sources</label>
              <textarea value={editSettings.defaultSources} onChange={(e) => patchSettings({ defaultSources: e.target.value })} rows={4} placeholder={"https://www.w3schools.com/\nhttps://developer.mozilla.org/"} className={`${inputClass} font-mono`} style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Slides Template URL <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <input type="url" value={editSettings.defaultTemplateUrl} onChange={(e) => patchSettings({ defaultTemplateUrl: e.target.value })} placeholder="https://docs.google.com/presentation/d/…" className={inputClass} style={inputStyle} />
            </div>
          </div>

          {/* Section Labels */}
          <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0cc0df]">Section Labels</p>
              <button type="button" onClick={() => patchSettings({ sectionLabels: DEFAULT_COURSE_SETTINGS.sectionLabels })} className="text-xs text-[#0cc0df] hover:underline">
                Reset to defaults
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SECTION_LABEL_KEYS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                  <input
                    type="text"
                    value={editSettings.sectionLabels[key]}
                    onChange={(e) => patchSectionLabel(key, e.target.value)}
                    placeholder={DEFAULT_COURSE_SETTINGS.sectionLabels[key]}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
            {saveMsg && <p className="text-sm text-[#2dd4a0]">{saveMsg}</p>}
              </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
