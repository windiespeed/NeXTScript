"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Course, CourseResource, CourseModule } from "@/types/course";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

const LESSON_TYPE_COLOR: Record<NonNullable<Lesson["lessonType"]>, { bg: string; text: string; label: string }> = {
  lesson:     { bg: "rgba(12,192,223,0.12)",   text: "#0cc0df",  label: "Lesson" },
  practice:   { bg: "var(--accent-purple-bg)", text: "var(--accent-purple)", label: "Practice" },
  project:    { bg: "rgba(255,140,74,0.12)",   text: "#ff8c4a",  label: "Project" },
  assessment: { bg: "rgba(45,212,160,0.12)",   text: "#2dd4a0",  label: "Assessment" },
  review:     { bg: "var(--bg-card-hover)",    text: "var(--text-muted)", label: "Review" },
};

const STATUS_COLOR: Record<Lesson["status"], string> = {
  draft: "bg-[var(--text-muted)]",
  generating: "bg-[#ff8c4a] animate-pulse",
  regenerating: "bg-[#0cc0df] animate-pulse",
  done: "bg-[#2dd4a0]",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<Lesson["status"], string> = {
  draft: "Draft", generating: "Generating…", regenerating: "Regenerating…", done: "Done", error: "Error",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const gripSVG = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
  </svg>
);

type SortableProps = {
  ref: (el: HTMLElement | null) => void;
  style: React.CSSProperties;
  grip: React.ReactNode;
};

function SortableLessonItem({ id, render }: { id: string; render: (s: SortableProps) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <>
      {render({
        ref: setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 },
        grip: (
          <div
            {...listeners} {...attributes}
            title="Drag to reorder"
            className="p-1 rounded-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {gripSVG}
          </div>
        ),
      })}
    </>
  );
}

function DroppableEmptySlot({ id, isOver }: { id: string; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="px-4 py-4 text-xs text-center rounded-b-3xl transition"
      style={{
        color: isOver ? "var(--accent)" : "var(--text-muted)",
        background: isOver ? "var(--accent-bg)" : "var(--bg-card)",
        outline: isOver ? "2px dashed var(--accent)" : undefined,
        outlineOffset: isOver ? "-2px" : undefined,
      }}
    >
      {isOver ? "Drop here" : "No lessons assigned — drag a lesson here or use the module dropdown."}
    </div>
  );
}

interface Props {
  driveId: string;
  onUnlink?: () => void;
}

export default function DriveCourseEditor({ driveId, onUnlink }: Props) {
  const id = driveId;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const [copied, setCopied] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicating, setDuplicating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [toAdd, setToAdd] = useState<Set<string>>(new Set());
  const [addingExisting, setAddingExisting] = useState(false);
  const [movingLessonId, setMovingLessonId] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [newResourceLabel, setNewResourceLabel] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [driveModules, setDriveModules] = useState<CourseModule[]>([]);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [assigningModuleForLesson, setAssigningModuleForLesson] = useState<string | null>(null);
  const [genPanelId, setGenPanelId] = useState<string | null>(null);
  const [genChecks, setGenChecks] = useState({ slides: true, overview: true, quiz: false });
  const [generatingLessonId, setGeneratingLessonId] = useState<string | null>(null);
  const [unassignedOrder, setUnassignedOrder] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overContainerId, setOverContainerId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [nextboxOpen, setNextboxOpen] = useState(true);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const [editingModuleSettings, setEditingModuleSettings] = useState<string | null>(null);
  const [nextboxPanelId, setNextboxPanelId] = useState<string | null>(null);
  const [releasingIds, setReleasingIds] = useState<Set<string>>(new Set());
  const [releaseMsg, setReleaseMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sort-unassigned-${id}`);
      if (saved) setUnassignedOrder(JSON.parse(saved));
    } catch {}
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${id}`).then(r => r.json()),
      fetch(`/api/lessons?courseId=${id}`).then(r => r.json()),
      fetch("/api/projects").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]).then(([courseData, lessonData, projectData, coursesData]) => {
      if (!courseData?.id) { setLoading(false); return; }
      setCourse(courseData);
      setProjects(Array.isArray(projectData) ? projectData : []);
      setLessons(Array.isArray(lessonData) ? lessonData : []);
      setAllCourses(Array.isArray(coursesData) ? coursesData : []);
      setResources(Array.isArray(courseData.resources) ? courseData.resources : []);
      setDriveModules(Array.isArray(courseData.modules) ? courseData.modules : []);
      setLoading(false);
    });
  }, [id]);


  async function handleToggleReleased(lesson: Lesson) {
    const updated = { ...lesson, released: !lesson.released };
    setLessons(prev => prev.map(l => l.id === lesson.id ? updated : l));
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
      fetch(`/api/lessons/${l.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ released: release }) })
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
      title: `Copy of ${full.title}`, topics: full.topics ?? "", deadline: full.deadline ?? "",
      tag: full.tag ?? "", subtitle: full.subtitle ?? "", overview: full.overview ?? "",
      learningTargets: full.learningTargets ?? "", vocabulary: full.vocabulary ?? "",
      warmUp: full.warmUp ?? "", slideContent: full.slideContent ?? "", guidedLab: full.guidedLab ?? "",
      selfPaced: full.selfPaced ?? "", submissionChecklist: full.submissionChecklist ?? "",
      checkpoint: full.checkpoint ?? "", industryBestPractices: full.industryBestPractices ?? "",
      devJournalPrompt: full.devJournalPrompt ?? "", rubric: full.rubric ?? "",
      sources: full.sources ?? "", studentLevel: full.studentLevel, quizQuestions: full.quizQuestions,
      courseId: id, released: false, folder: full.folder ?? "",
    };
    const res = await fetch("/api/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const copy = await res.json();
    await fetch(`/api/courses/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
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
    setSelectedIds(new Set()); setSelecting(false); setDuplicating(false);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} lesson${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    await Promise.all(ids.map(lid => fetch(`/api/lessons/${lid}`, { method: "DELETE" })));
    setLessons(prev => prev.filter(l => !selectedIds.has(l.id)));
    setCourse(prev => prev ? { ...prev, lessonIds: prev.lessonIds.filter(l => !selectedIds.has(l)) } : prev);
    setSelectedIds(new Set()); setSelecting(false); setBulkDeleting(false);
  }

  async function handleBulkMove(targetCourseId: string) {
    if (selectedIds.size === 0) return;
    setBulkMoving(true); setBulkMoveOpen(false);
    const ids = [...selectedIds];
    const targetCourse = allCourses.find(c => c.id === targetCourseId);
    await fetch(`/api/courses/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: course!.lessonIds.filter(l => !selectedIds.has(l)) }),
    });
    if (targetCourse) {
      await fetch(`/api/courses/${targetCourseId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonIds: [...targetCourse.lessonIds, ...ids.filter(l => !targetCourse.lessonIds.includes(l))] }),
      });
    }
    await Promise.all(ids.map(lid => fetch(`/api/lessons/${lid}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: targetCourseId, released: false }),
    })));
    setLessons(prev => prev.filter(l => !selectedIds.has(l.id)));
    setCourse(prev => prev ? { ...prev, lessonIds: prev.lessonIds.filter(l => !selectedIds.has(l)) } : prev);
    setSelectedIds(new Set()); setSelecting(false); setBulkMoving(false);
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
    setAddExistingOpen(false); setAddingExisting(false);
  }

  async function handleMoveLesson(lessonId: string, newCourseId: string) {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    await fetch(`/api/courses/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: course!.lessonIds.filter(l => l !== lessonId) }),
    });
    const newCourse = allCourses.find(c => c.id === newCourseId);
    if (newCourse) {
      await fetch(`/api/courses/${newCourseId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonIds: [...newCourse.lessonIds, lessonId] }),
      });
    }
    await fetch(`/api/lessons/${lessonId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: newCourseId, released: false }),
    });
    setLessons(prev => prev.filter(l => l.id !== lessonId));
    setCourse(prev => prev ? { ...prev, lessonIds: prev.lessonIds.filter(l => l !== lessonId) } : prev);
    setMovingLessonId(null);
  }

  async function handleRemoveLesson(lessonId: string) {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    await fetch(`/api/courses/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds: course!.lessonIds.filter(l => l !== lessonId) }),
    });
    if (driveModules.some(m => m.lessonIds.includes(lessonId))) {
      const updatedModules = driveModules.map(m => ({ ...m, lessonIds: m.lessonIds.filter(lid => lid !== lessonId) }));
      setDriveModules(updatedModules);
    }
    await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    setLessons(prev => prev.filter(l => l.id !== lessonId));
    setCourse(prev => prev ? { ...prev, lessonIds: prev.lessonIds.filter(l => l !== lessonId) } : prev);
  }

  async function handleCreateCourseFolder() {
    setCreatingFolder(true);
    const res = await fetch(`/api/courses/${id}/folder`, { method: "POST" });
    setCreatingFolder(false);
    if (res.ok) { const updated = await res.json(); setCourse(updated); }
  }

  async function handleAddResource() {
    if (!newResourceLabel.trim() || !newResourceUrl.trim()) return;
    const newResource: CourseResource = { id: crypto.randomUUID(), label: newResourceLabel.trim(), url: newResourceUrl.trim() };
    const updated = [...resources, newResource];
    setResources(updated);
    setCourse(prev => prev ? { ...prev, resources: updated } : prev);
    setNewResourceLabel(""); setNewResourceUrl(""); setAddResourceOpen(false);
    await fetch(`/api/courses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resources: updated }) });
  }

  async function handleRemoveResource(resourceId: string) {
    const updated = resources.filter(r => r.id !== resourceId);
    setResources(updated);
    setCourse(prev => prev ? { ...prev, resources: updated } : prev);
    await fetch(`/api/courses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resources: updated }) });
  }

  async function saveModules(updated: CourseModule[]) {
    setDriveModules(updated);
    setCourse(prev => prev ? { ...prev, modules: updated } : prev);
    await fetch(`/api/courses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modules: updated }) });
  }

  function handleAddModule() {
    const newModule: CourseModule = { id: crypto.randomUUID(), title: `Module ${driveModules.length + 1}`, lessonIds: [] };
    saveModules([...driveModules, newModule]);
    setEditingModuleId(newModule.id);
    setEditModuleTitle(newModule.title);
  }

  function handleSaveModuleTitle(modId: string) {
    if (!editModuleTitle.trim()) { setEditingModuleId(null); return; }
    saveModules(driveModules.map(m => m.id === modId ? { ...m, title: editModuleTitle.trim() } : m));
    setEditingModuleId(null);
  }

  function handleDeleteModule(modId: string) {
    if (!confirm("Delete this module group? Lessons will become unassigned.")) return;
    saveModules(driveModules.filter(m => m.id !== modId));
  }

  function handleAssignToModule(lessonId: string, moduleId: string | null) {
    const updated = driveModules.map(m => ({
      ...m,
      lessonIds: m.id === moduleId
        ? m.lessonIds.includes(lessonId) ? m.lessonIds : [...m.lessonIds, lessonId]
        : m.lessonIds.filter(lid => lid !== lessonId),
    }));
    saveModules(updated);
    setAssigningModuleForLesson(null);
  }

  function toggleModuleCollapse(modId: string) {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      next.has(modId) ? next.delete(modId) : next.add(modId);
      return next;
    });
  }

  function handleGlobalDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null); setOverContainerId(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceContainerId = active.data.current?.sortable?.containerId as string | undefined;
    const targetContainerId = (over.data.current?.sortable?.containerId ?? overId) as string;
    if (!sourceContainerId) return;

    if (sourceContainerId === targetContainerId) {
      if (sourceContainerId === "unassigned") {
        if (activeId === overId) return;
        const assignedIds = new Set(driveModules.flatMap(m => m.lessonIds));
        const unassignedBase = lessons.filter(l => !assignedIds.has(l.id));
        const orderedIds = unassignedOrder.filter(uid => unassignedBase.some(l => l.id === uid));
        const unordered = unassignedBase.filter(l => !unassignedOrder.includes(l.id));
        const sorted = [...orderedIds.map(uid => unassignedBase.find(l => l.id === uid)!), ...unordered];
        const oldIndex = sorted.findIndex(l => l.id === activeId);
        const newIndex = sorted.findIndex(l => l.id === overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const newOrder = arrayMove(sorted, oldIndex, newIndex).map(l => l.id);
        setUnassignedOrder(newOrder);
        localStorage.setItem(`sort-unassigned-${id}`, JSON.stringify(newOrder));
      } else {
        if (activeId === overId) return;
        const modId = sourceContainerId.replace("module-", "");
        const mod = driveModules.find(m => m.id === modId);
        if (!mod) return;
        const oldIndex = mod.lessonIds.indexOf(activeId);
        const newIndex = mod.lessonIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        saveModules(driveModules.map(m => m.id === modId ? { ...m, lessonIds: arrayMove(mod.lessonIds, oldIndex, newIndex) } : m));
      }
    } else {
      const targetModId = targetContainerId === "unassigned" ? null : targetContainerId.replace("module-", "");
      const updated = driveModules.map(m => {
        if (`module-${m.id}` === sourceContainerId) return { ...m, lessonIds: m.lessonIds.filter(lid => lid !== activeId) };
        if (targetModId && m.id === targetModId) {
          const overIndex = m.lessonIds.indexOf(overId);
          if (overIndex === -1) return { ...m, lessonIds: [...m.lessonIds, activeId] };
          const newIds = [...m.lessonIds];
          newIds.splice(overIndex, 0, activeId);
          return { ...m, lessonIds: newIds };
        }
        return m;
      });
      if (targetModId === null) {
        const newOrder = [...unassignedOrder.filter(uid => uid !== activeId), activeId];
        setUnassignedOrder(newOrder);
        localStorage.setItem(`sort-unassigned-${id}`, JSON.stringify(newOrder));
      }
      if (sourceContainerId === "unassigned") {
        const newOrder = unassignedOrder.filter(uid => uid !== activeId);
        setUnassignedOrder(newOrder);
        localStorage.setItem(`sort-unassigned-${id}`, JSON.stringify(newOrder));
      }
      saveModules(updated);
      setAssigningModuleForLesson(null);
    }
  }

  async function handleGenerateLesson(lessonId: string) {
    setGenPanelId(null);
    setGeneratingLessonId(lessonId);
    const files: string[] = [];
    if (genChecks.slides) files.push("slides");
    if (genChecks.overview) files.push("doc");
    if (genChecks.quiz) files.push("form");
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: "generating" } : l));
    try {
      const res = await fetch(`/api/generate/${lessonId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, destination: "drive" }),
      });
      const data = await res.json();
      if (res.ok) {
        setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: "done", folderUrl: data.folderUrl ?? l.folderUrl } : l));
      } else {
        setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: "error" } : l));
      }
    } catch {
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: "error" } : l));
    }
    setGeneratingLessonId(null);
  }

  async function handlePatchLesson(lessonId: string, patch: Partial<Lesson>) {
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, ...patch } : l));
    await fetch(`/api/lessons/${lessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function handleReleaseToClassroom(lessonIds: string[], moduleName?: string) {
    if (!course?.googleClassroomId) {
      setReleaseMsg({ text: "Link a Google Classroom in Course Settings first.", ok: false });
      setTimeout(() => setReleaseMsg(null), 4000);
      return;
    }
    setReleasingIds(prev => new Set([...prev, ...lessonIds]));
    setReleaseMsg(null);
    try {
      const res = await fetch("/api/classroom/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonIds, courseId: id, moduleName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push failed.");
      const msg = data.failed > 0
        ? `${data.pushed} pushed, ${data.failed} failed.`
        : `${data.pushed} lesson${data.pushed !== 1 ? "s" : ""} released to Classroom.`;
      setReleaseMsg({ text: msg, ok: data.failed === 0 });
    } catch (e: any) {
      setReleaseMsg({ text: e.message || "Push failed.", ok: false });
    } finally {
      setReleasingIds(prev => { const next = new Set(prev); lessonIds.forEach(id => next.delete(id)); return next; });
      setTimeout(() => setReleaseMsg(null), 5000);
    }
  }

  async function handleGenerateJoinCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const res = await fetch(`/api/courses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: code }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCourse(updated);
    }
  }

  async function handleReleaseModule(modId: string, release: boolean) {
    const mod = driveModules.find(m => m.id === modId);
    if (!mod) return;
    const targets = mod.lessonIds
      .map(lid => lessons.find(l => l.id === lid))
      .filter((l): l is Lesson => !!l && l.released !== release);
    if (targets.length === 0) return;
    setLessons(prev => prev.map(l => mod.lessonIds.includes(l.id) ? { ...l, released: release } : l));
    await Promise.all(targets.map(l =>
      fetch(`/api/lessons/${l.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ released: release }) })
    ));
  }

  if (loading) return <p className="text-sm text-[#0cc0df] py-4">Loading…</p>;
  if (!course) return <p className="text-sm text-red-500 py-4">Drive course not found.</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>{course.title}</h2>
          {course.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{course.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {course.settings?.subject && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.settings.subject}</span>
            )}
            {course.gradeLevel && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{course.gradeLevel}</span>
            )}
            {course.settings?.studentLevel && (
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-[#0cc0df] capitalize" style={{ background: "var(--accent-bg)" }}>{course.settings.studentLevel}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{lessons.length}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lessons.length === 1 ? "lesson" : "lessons"}</p>
          {lessons.length > 0 && (
            <div className="w-20 mt-1">
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full bg-[#2dd4a0] transition-all duration-500"
                  style={{ width: `${Math.round((lessons.filter(l => l.released).length / lessons.length) * 100)}%` }} />
              </div>
              <p className="text-[10px] mt-0.5 text-right" style={{ color: "var(--text-muted)" }}>
                {lessons.filter(l => l.released).length}/{lessons.length} released to NeXTBox
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Drive Folder + Resources */}
      <div className="rounded-3xl p-4 space-y-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Course Resources</p>
          <div className="flex items-center gap-2 flex-wrap">
            {course.driveFolderUrl ? (
              <a href={course.driveFolderUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                style={{ background: "rgba(45,212,160,0.12)", border: "1px solid rgba(45,212,160,0.35)", color: "#2dd4a0" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Course Folder ↗
              </a>
            ) : (
              <button onClick={handleCreateCourseFolder} disabled={creatingFolder}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card)] disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {creatingFolder ? "Creating…" : "Create Drive Folder"}
              </button>
            )}
            <button onClick={() => setAddResourceOpen(true)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--accent-bg)]"
              style={{ color: "#0cc0df" }}>
              + Add Resource
            </button>
            {onUnlink && (
              <button onClick={onUnlink}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-70"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                Unlink
              </button>
            )}
          </div>
        </div>
        {resources.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No resources yet. Add Drive links, syllabi, or reference docs.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resources.map(r => (
              <div key={r.id} className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--accent-purple-bg)", border: "1px solid rgba(99,102,241,0.30)", color: "var(--accent-purple)" }}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.label} ↗</a>
                <button onClick={() => handleRemoveResource(r.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500 leading-none">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Release feedback */}
      {releaseMsg && (
        <div className="rounded-2xl px-4 py-2.5 text-xs font-medium" style={{
          background: releaseMsg.ok ? "rgba(45,212,160,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${releaseMsg.ok ? "rgba(45,212,160,0.25)" : "rgba(239,68,68,0.25)"}`,
          color: releaseMsg.ok ? "#2dd4a0" : "#ef4444",
        }}>
          {releaseMsg.text}
        </div>
      )}

      {/* NeXTBox Panel */}
      <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer transition hover:bg-[var(--bg-card-hover)]"
          style={{ background: "var(--bg-card)" }}
          onClick={() => setNextboxOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)" }}>
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
              <path d="M9 8l3 3-3 3"/><path d="M15 14h-3"/>
            </svg>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>NeXTBox</p>
            {(course.studentIds?.length ?? 0) > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(12,192,223,0.1)", color: "#0cc0df" }}>
                {course.studentIds!.length} student{course.studentIds!.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform duration-200" style={{ transform: nextboxOpen ? "rotate(90deg)" : "rotate(0deg)", color: "var(--text-muted)" }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {nextboxOpen && (
          <div className="px-4 pb-4 pt-3 space-y-4" style={{ background: "var(--bg-card-hover)" }}>
            {/* Join Code + Progress */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Join Code</p>
                {course.joinCode ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xl font-bold tracking-[0.15em]" style={{ color: "#0cc0df" }}>{course.joinCode}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(course.joinCode!); setJoinCodeCopied(true); setTimeout(() => setJoinCodeCopied(false), 2000); }}
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80"
                      style={{ background: "rgba(12,192,223,0.1)", color: "#0cc0df" }}>
                      {joinCodeCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleGenerateJoinCode}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                    style={{ background: "rgba(12,192,223,0.1)", color: "#0cc0df" }}>
                    Generate Join Code
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 self-end">
                <Link href={`/courses/${id}/settings`}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Course Settings →
                </Link>
                <Link href={`/courses/${id}/progress`}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  View Progress →
                </Link>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Lessons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} in this course
            {lessons.filter(l => l.released).length > 0 && (
              <span className="ml-2 text-[#2dd4a0]">· {lessons.filter(l => l.released).length} released</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {selecting ? (
              <>
                <button onClick={() => { setSelecting(false); setSelectedIds(new Set()); }}
                  className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={() => setSelectedIds(selectedIds.size === lessons.length ? new Set() : new Set(lessons.map(l => l.id)))}
                  className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {selectedIds.size === lessons.length ? "Unselect All" : "Select All"}
                </button>
                <div className="relative">
                  <button onClick={() => allCourses.filter(c => c.id !== id).length > 0 && setBulkMoveOpen(v => !v)}
                    disabled={selectedIds.size === 0 || duplicating || bulkDeleting || bulkMoving}
                    className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {bulkMoving ? "Moving…" : `Move To${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                  </button>
                  {bulkMoveOpen && (
                    <>
                    <div className="fixed inset-0 z-20" onClick={() => setBulkMoveOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[180px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Move to…</p>
                      {allCourses.filter(c => c.id !== id).map(c => (
                        <button key={c.id} onClick={() => handleBulkMove(c.id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                          style={{ color: "var(--text-primary)" }}>{c.title}</button>
                      ))}
                    </div>
                    </>
                  )}
                </div>
                <button onClick={handleBulkDuplicate} disabled={selectedIds.size === 0 || duplicating || bulkDeleting || bulkMoving}
                  className="rounded-full bg-[#0cc0df] px-3 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition">
                  {duplicating ? "Duplicating…" : `Duplicate${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                </button>
                <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || duplicating || bulkDeleting || bulkMoving}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition"
                  style={{ border: "1px solid var(--border)" }}>
                  {bulkDeleting ? "Deleting…" : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                </button>
              </>
            ) : (
              <>
                {lessons.length > 0 && (
                  <button onClick={() => setSelecting(true)}
                    className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Select</button>
                )}
                {driveModules.length > 0 && (
                  <button onClick={() => setCollapsedModules(collapsedModules.size === driveModules.length ? new Set() : new Set(driveModules.map(m => m.id)))}
                    className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {collapsedModules.size === driveModules.length ? "Expand All" : "Collapse All"}
                  </button>
                )}
                <div className="relative">
                  <button onClick={() => setMoreOpen(v => !v)} title="More options"
                    className="p-2 rounded-full transition hover:bg-[var(--bg-card-hover)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                  </button>
                  {moreOpen && (
                    <>
                    <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[180px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }} onClick={() => setMoreOpen(false)}>
                      <button onClick={handleAddModule} className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition" style={{ color: "var(--text-primary)" }}>+ Add Module Group</button>
                      <button onClick={openAddExisting} className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition" style={{ color: "var(--text-primary)" }}>Add Existing Lesson</button>
                      <Link href={`/quizzes/new?courseId=${id}`} className="block px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition" style={{ color: "var(--text-primary)" }}>New Quiz</Link>
                      <Link href={`/courses/${id}/batch-slides`} className="block px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition" style={{ color: "var(--text-primary)" }}>Batch Generate</Link>
                      {lessons.length > 0 && (
                        <button onClick={() => handleBulkRelease(!lessons.every(l => l.released))}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition"
                          style={{ color: "var(--text-primary)" }}>
                          {lessons.every(l => l.released) ? "Unrelease All" : "Release All to NeXTBox"}
                        </button>
                      )}
                      {lessons.length > 0 && (
                        <button
                          onClick={() => { setMoreOpen(false); handleReleaseToClassroom(lessons.map(l => l.id)); }}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition"
                          style={{ color: "var(--text-primary)" }}>
                          Publish All to Classroom
                        </button>
                      )}
                      <div style={{ borderTop: "1px solid var(--border)" }}>
                        <button onClick={handleCopyLink}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition"
                          style={{ color: "#2dd4a0" }}>
                          {copied ? "Link Copied!" : "Copy Student Link"}
                        </button>
                        <a href={`/courses/${id}/student`} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition"
                          style={{ color: "#2dd4a0" }}>Student View ↗</a>
                      </div>
                      <div style={{ borderTop: "1px solid var(--border)" }}>
                        <Link href={`/courses/${id}/settings`} onClick={() => setMoreOpen(false)}
                          className="block px-4 py-2.5 text-xs hover:bg-[var(--bg-card-hover)] transition"
                          style={{ color: "var(--text-primary)" }}>Course Settings ⚙</Link>
                      </div>
                    </div>
                    </>
                  )}
                </div>
                <Link href={`/lessons/new?courseId=${id}`}
                  className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition shadow">
                  + New Lesson
                </Link>
              </>
            )}
          </div>
        </div>

        {lessons.length === 0 && driveModules.length === 0 ? (
          <div className="text-center py-10 rounded-3xl" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No lessons yet.</p>
            <Link href={`/lessons/new?courseId=${id}`}
              className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
              Add first lesson
            </Link>
          </div>
        ) : (() => {
          const assignedIds = new Set(driveModules.flatMap(m => m.lessonIds));
          const unassignedBase = lessons.filter(l => !assignedIds.has(l.id));
          const unassigned = [
            ...unassignedOrder.filter(uid => unassignedBase.some(l => l.id === uid)).map(uid => unassignedBase.find(l => l.id === uid)!),
            ...unassignedBase.filter(l => !unassignedOrder.includes(l.id)),
          ];

          function renderLessonRow(lesson: Lesson, i: number, isFirst: boolean, isLast = false, roundTop = false, sortable?: SortableProps) {
            return (
              <div
                key={lesson.id}
                ref={sortable?.ref}
                onClick={selecting ? () => toggleSelect(lesson.id) : undefined}
                className={`group flex items-center gap-4 px-4 py-3 transition ${roundTop && isFirst ? "rounded-t-3xl" : ""} ${isLast ? "rounded-b-3xl" : ""} ${selecting ? "cursor-pointer" : "hover:bg-[var(--bg-card-hover)]"} ${selecting && selectedIds.has(lesson.id) ? "bg-[#0cc0df]/10" : ""}`}
                style={{ background: selecting && selectedIds.has(lesson.id) ? undefined : "var(--bg-card)", borderTop: !isFirst ? "1px solid var(--border)" : undefined, ...sortable?.style }}
              >
                {sortable?.grip}
                {selecting ? (
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${selectedIds.has(lesson.id) ? "bg-[#0cc0df] border-[#0cc0df]" : "border-[var(--border)]"}`}
                    style={selectedIds.has(lesson.id) ? {} : { background: "var(--bg-body)" }}>
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
                    {lesson.subtitle && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{lesson.subtitle}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{STATUS_LABEL[lesson.status]}</span>
                    {lesson.lessonType && lesson.lessonType !== "lesson" && (() => {
                      const t = LESSON_TYPE_COLOR[lesson.lessonType];
                      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: t.bg, color: t.text }}>{t.label}</span>;
                    })()}
                    {driveModules.length > 0 && !selecting && (() => {
                      const currentModule = driveModules.find(m => m.lessonIds.includes(lesson.id));
                      return (
                        <div className="relative">
                          <button onClick={e => { e.stopPropagation(); setAssigningModuleForLesson(assigningModuleForLesson === lesson.id ? null : lesson.id); }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition hover:opacity-80"
                            style={currentModule
                              ? { background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }
                              : { background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px dashed var(--border)" }}>
                            {currentModule ? currentModule.title : "Unassigned"}
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {assigningModuleForLesson === lesson.id && (
                            <>
                            <div className="fixed inset-0 z-20" onClick={() => setAssigningModuleForLesson(null)} />
                            <div className="absolute left-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[200px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                              <button onClick={() => handleAssignToModule(lesson.id, null)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                                style={{ color: "var(--text-muted)" }}>No module group</button>
                              {driveModules.map(m => (
                                <button key={m.id} onClick={() => handleAssignToModule(lesson.id, m.id)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                                  style={{ color: m.id === currentModule?.id ? "var(--accent-purple)" : "var(--text-primary)", fontWeight: m.id === currentModule?.id ? 600 : 400 }}>
                                  {m.id === currentModule?.id ? "✓ " : ""}{m.title}
                                </button>
                              ))}
                            </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    {(course?.assignedConcepts?.length ?? 0) > 0 && !selecting && (
                      <select
                        value={lesson.concept ?? ""}
                        onChange={e => { e.stopPropagation(); handlePatchLesson(lesson.id, { concept: e.target.value || undefined }); }}
                        onClick={e => e.stopPropagation()}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0cc0df] max-w-[120px]"
                        style={lesson.concept
                          ? { background: "rgba(12,192,223,0.1)", color: "#0cc0df", border: "1px solid rgba(12,192,223,0.3)" }
                          : { background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px dashed var(--border)" }}>
                        <option value="">No concept</option>
                        {course!.assignedConcepts!.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                    {lesson.deadline && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Due {lesson.deadline}</span>}
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Created {fmt(lesson.createdAt)}{lesson.updatedAt !== lesson.createdAt && <> · Modified {fmt(lesson.updatedAt)}</>}
                    </span>
                  </div>
                </div>
                {!selecting && (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Release to NeXTBox */}
                    <button onClick={() => handleToggleReleased(lesson)}
                      title={lesson.released ? "Click to unrelease from NeXTBox" : "Release to NeXTBox"}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${lesson.released ? "bg-[#2dd4a0]/15 text-[#2dd4a0] hover:bg-[#2dd4a0]/25" : "hover:bg-[var(--bg-card-hover)]"}`}
                      style={lesson.released ? {} : { border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      {lesson.released ? "Released" : "Release"}
                    </button>
                    {/* Publish to Google Classroom */}
                    {(() => {
                      const currentModule = driveModules.find(m => m.lessonIds.includes(lesson.id));
                      const isPublishing = releasingIds.has(lesson.id);
                      return (
                        <button
                          onClick={() => handleReleaseToClassroom([lesson.id], currentModule?.title)}
                          disabled={isPublishing}
                          title={course?.googleClassroomId ? "Publish to Google Classroom" : "Link a classroom in Course Settings first"}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                          style={{ border: "1px solid var(--border)", color: course?.googleClassroomId ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {isPublishing ? "Publishing…" : "Publish"}
                        </button>
                      );
                    })()}
                    <Link href={`/lessons/${lesson.id}`}
                      className="rounded-full bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition">View</Link>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); genPanelId === lesson.id ? setGenPanelId(null) : (setGenPanelId(lesson.id), setGenChecks({ slides: true, overview: true, quiz: false })); }}
                        disabled={generatingLessonId === lesson.id}
                        className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition">
                        {generatingLessonId === lesson.id ? "Generating…" : "Generate"}
                      </button>
                      {genPanelId === lesson.id && (
                        <>
                        <div className="fixed inset-0 z-20" onClick={() => setGenPanelId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-30 rounded-2xl p-3 min-w-[190px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>What to generate</p>
                          <label className="flex items-center gap-2 text-xs mb-1.5 cursor-pointer" style={{ color: "var(--text-primary)" }}>
                            <input type="checkbox" checked={genChecks.slides} onChange={e => setGenChecks(c => ({ ...c, slides: e.target.checked }))} className="accent-[#0cc0df]" />Slides
                          </label>
                          <label className="flex items-center gap-2 text-xs mb-1.5 cursor-pointer" style={{ color: "var(--text-primary)" }}>
                            <input type="checkbox" checked={genChecks.overview} onChange={e => setGenChecks(c => ({ ...c, overview: e.target.checked }))} className="accent-[#0cc0df]" />Overview Doc
                          </label>
                          <label className="flex items-center gap-2 text-xs mb-3 cursor-pointer" style={{ color: "var(--text-primary)" }}>
                            <input type="checkbox" checked={genChecks.quiz} onChange={e => setGenChecks(c => ({ ...c, quiz: e.target.checked }))} className="accent-[#0cc0df]" />Quiz
                          </label>
                          <button onClick={() => handleGenerateLesson(lesson.id)}
                            disabled={!genChecks.slides && !genChecks.overview && !genChecks.quiz}
                            className="w-full rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition">Generate</button>
                        </div>
                        </>
                      )}
                    </div>
                    {/* NeXTBox per-lesson overrides */}
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setNextboxPanelId(nextboxPanelId === lesson.id ? null : lesson.id); }}
                        title="NeXTBox settings"
                        className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]"
                        style={{ color: nextboxPanelId === lesson.id ? "#0cc0df" : "var(--text-muted)" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M9 8l3 3-3 3"/><path d="M15 14h-3"/></svg>
                      </button>
                      {nextboxPanelId === lesson.id && (
                        <>
                        <div className="fixed inset-0 z-20" onClick={() => setNextboxPanelId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-30 rounded-2xl p-3 min-w-[200px] space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>NeXTBox Overrides</p>
                          <div>
                            <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Progress Mode</label>
                            <select
                              value={lesson.progressMode ?? ""}
                              onChange={e => handlePatchLesson(lesson.id, { progressMode: (e.target.value || undefined) as any })}
                              className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0cc0df]"
                              style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                              <option value="">Inherit from module</option>
                              <option value="sequential">Sequential</option>
                              <option value="locked">Locked</option>
                              <option value="free">Free</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Solution After (attempts)</label>
                            <input
                              type="number" min="1"
                              value={lesson.solutionRevealAttempts ?? ""}
                              onChange={e => handlePatchLesson(lesson.id, { solutionRevealAttempts: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
                              placeholder="Inherit from module"
                              className="w-full rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0cc0df]"
                              style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                          </div>
                        </div>
                        </>
                      )}
                    </div>
                    <button onClick={() => handleDuplicateLesson(lesson)} title="Duplicate lesson"
                      className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-muted)" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    {allCourses.filter(c => c.id !== id).length > 0 && (
                      <div className="relative">
                        <button onClick={() => setMovingLessonId(movingLessonId === lesson.id ? null : lesson.id)} title="Move to course"
                          className="p-1.5 rounded-full transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-muted)" }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </button>
                        {movingLessonId === lesson.id && (
                          <>
                          <div className="fixed inset-0 z-20" onClick={() => setMovingLessonId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[180px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Move to…</p>
                            {allCourses.filter(c => c.id !== id).map(c => (
                              <button key={c.id} onClick={() => handleMoveLesson(lesson.id, c.id)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                                style={{ color: "var(--text-primary)" }}>{c.title}</button>
                            ))}
                          </div>
                          </>
                        )}
                      </div>
                    )}
                    <button onClick={() => handleRemoveLesson(lesson.id)} title="Delete lesson"
                      className="p-1.5 rounded-full transition hover:text-red-500 hover:bg-red-500/10"
                      style={{ color: "var(--text-muted)" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <DndContext sensors={sensors} collisionDetection={closestCenter}
              onDragStart={({ active }: DragStartEvent) => setActiveDragId(active.id as string)}
              onDragOver={({ over }) => setOverContainerId(over ? ((over.data.current?.sortable?.containerId ?? over.id) as string) : null)}
              onDragEnd={handleGlobalDragEnd}>
              <div className="space-y-3">
                {driveModules.map(mod => {
                  const modLessons = mod.lessonIds.map(lid => lessons.find(l => l.id === lid)).filter(Boolean) as Lesson[];
                  const collapsed = collapsedModules.has(mod.id);
                  const containerKey = `module-${mod.id}`;
                  return (
                    <div key={mod.id} className="rounded-3xl" style={{ border: "1px solid var(--border)" }}>
                      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-t-3xl ${collapsed ? "rounded-b-3xl" : ""}`}
                        style={{ background: "var(--bg-card)", borderBottom: collapsed ? undefined : "1px solid var(--border)" }}>
                        <button onClick={() => toggleModuleCollapse(mod.id)} className="p-0.5 rounded transition hover:bg-[var(--bg-card)]" style={{ color: "var(--text-muted)" }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {editingModuleId === mod.id ? (
                          <input autoFocus value={editModuleTitle} onChange={e => setEditModuleTitle(e.target.value)}
                            onBlur={() => handleSaveModuleTitle(mod.id)}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveModuleTitle(mod.id); if (e.key === "Escape") setEditingModuleId(null); }}
                            className="flex-1 rounded-md px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                            style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                        ) : (
                          <span className="flex-1 text-sm font-semibold" style={{ color: "var(--accent)" }}>{mod.title}</span>
                        )}
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{modLessons.length} {modLessons.length === 1 ? "lesson" : "lessons"}</span>
                        {modLessons.length > 0 && (() => {
                          const allPublished = modLessons.every(l => l.released);
                          const modLessonIds = modLessons.map(l => l.id);
                          const anyReleasing = modLessonIds.some(lid => releasingIds.has(lid));
                          return (
                            <>
                              <button
                                onClick={() => handleReleaseModule(mod.id, !allPublished)}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold transition"
                                style={allPublished
                                  ? { background: "rgba(45,212,160,0.12)", color: "#2dd4a0" }
                                  : { background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                                {allPublished ? "Unrelease All" : "Release All"}
                              </button>
                              <button
                                onClick={() => handleReleaseToClassroom(modLessonIds, mod.title)}
                                disabled={anyReleasing}
                                title={course?.googleClassroomId ? "Publish module to Google Classroom" : "Link a classroom in Course Settings first"}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-50"
                                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                                {anyReleasing ? "Publishing…" : "Publish"}
                              </button>
                            </>
                          );
                        })()}
                        <button onClick={() => { setEditingModuleId(mod.id); setEditModuleTitle(mod.title); }} title="Rename"
                          className="p-1 rounded transition hover:bg-[var(--bg-card)]" style={{ color: "var(--text-muted)" }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => handleDeleteModule(mod.id)} title="Delete module group"
                          className="p-1 rounded transition hover:text-red-500 hover:bg-red-500/10" style={{ color: "var(--text-muted)" }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                      {!collapsed && (
                        <>
                          {/* Module NeXTBox settings bar */}
                          <div className="flex items-center gap-4 px-4 py-2 border-b" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
                            <span className="text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: "var(--text-muted)" }}>NeXTBox</span>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>Progress:</label>
                              <select
                                value={mod.progressMode ?? ""}
                                onChange={e => saveModules(driveModules.map(m => m.id === mod.id ? { ...m, progressMode: (e.target.value || undefined) as any } : m))}
                                className="rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0cc0df]"
                                style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                                <option value="">Default</option>
                                <option value="sequential">Sequential</option>
                                <option value="locked">Locked</option>
                                <option value="free">Free</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>Solution after:</label>
                              <input
                                type="number" min="1"
                                value={mod.solutionRevealAttempts ?? ""}
                                onChange={e => saveModules(driveModules.map(m => m.id === mod.id ? { ...m, solutionRevealAttempts: e.target.value === "" ? null : parseInt(e.target.value, 10) } : m))}
                                placeholder="Never"
                                className="w-16 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0cc0df]"
                                style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>attempts</span>
                            </div>
                          </div>
                          {modLessons.length === 0 ? (
                            <DroppableEmptySlot id={containerKey} isOver={overContainerId === containerKey} />
                          ) : (
                            <SortableContext id={containerKey} items={mod.lessonIds} strategy={verticalListSortingStrategy}>
                              {modLessons.map((lesson, i) => (
                                <SortableLessonItem key={lesson.id} id={lesson.id}
                                  render={s => renderLessonRow(lesson, i, i === 0, i === modLessons.length - 1, false, s)} />
                              ))}
                            </SortableContext>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {(unassigned.length > 0 || driveModules.length === 0) && (
                  <div className="rounded-3xl" style={{ border: "1px solid var(--border)" }}>
                    {driveModules.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-3xl" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                        <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Unassigned</span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{unassigned.length} {unassigned.length === 1 ? "lesson" : "lessons"}</span>
                      </div>
                    )}
                    <SortableContext id="unassigned" items={unassigned.map(l => l.id)} strategy={verticalListSortingStrategy}>
                      {unassigned.map((lesson, i) => (
                        <SortableLessonItem key={lesson.id} id={lesson.id}
                          render={s => renderLessonRow(lesson, i, i === 0, i === unassigned.length - 1, driveModules.length === 0, s)} />
                      ))}
                    </SortableContext>
                  </div>
                )}
              </div>
              <DragOverlay>
                {activeDragId ? (() => {
                  const lesson = lessons.find(l => l.id === activeDragId);
                  return lesson ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--accent)", opacity: 0.95 }}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[lesson.status]}`} />
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                    </div>
                  ) : null;
                })() : null}
              </DragOverlay>
            </DndContext>
          );
        })()}
      </div>

      {/* Add Existing Lesson Modal */}
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
                    <button key={l.id} onClick={() => setToAdd(prev => { const next = new Set(prev); next.has(l.id) ? next.delete(l.id) : next.add(l.id); return next; })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition hover:bg-[var(--bg-card-hover)]">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${toAdd.has(l.id) ? "bg-[#0cc0df] border-[#0cc0df]" : "border-[var(--border)]"}`}
                        style={toAdd.has(l.id) ? {} : { background: "var(--bg-body)" }}>
                        {toAdd.has(l.id) && <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-[#0a0b13]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{l.title}</p>
                        {l.courseId && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Currently in: {allCourses.find(c => c.id === l.courseId)?.title ?? "another course"}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex items-center gap-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={handleAddExisting} disabled={toAdd.size === 0 || addingExisting}
                className="rounded-full bg-[#0cc0df] px-5 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition">
                {addingExisting ? "Adding…" : `Add${toAdd.size > 0 ? ` (${toAdd.size})` : ""}`}
              </button>
              <button onClick={() => setAddExistingOpen(false)} className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
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
                <input type="text" value={newResourceLabel} onChange={e => setNewResourceLabel(e.target.value)}
                  placeholder="e.g. Syllabus, Reference Sheet" className={inputClass} style={inputStyle} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>URL</label>
                <input type="url" value={newResourceUrl} onChange={e => setNewResourceUrl(e.target.value)}
                  placeholder="https://drive.google.com/…" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={handleAddResource} disabled={!newResourceLabel.trim() || !newResourceUrl.trim()}
                className="rounded-full bg-[#0cc0df] px-5 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition">Add</button>
              <button onClick={() => setAddResourceOpen(false)} className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
