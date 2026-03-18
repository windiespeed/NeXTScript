"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import LessonCard from "@/components/LessonCard";
import GenerateModal from "@/components/GenerateModal";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";

type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";

interface SortableCardProps {
  lesson: Lesson;
  projects: SavedProject[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenModal: (id: string) => void;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

function SortableLessonCard({ lesson, ...props }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <LessonCard
        lesson={lesson}
        {...props}
        gripProps={{ ...listeners, ...attributes }}
      />
    </div>
  );
}

function Dashboard() {
  const { status } = useSession();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalLessonId, setModalLessonId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDuplicating, setBulkDuplicating] = useState(false);
  const [lessonOrder, setLessonOrder] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const modalLesson = lessons.find(l => l.id === modalLessonId) ?? null;

  // Sort: unordered (new) lessons first by updatedAt, then ordered lessons in saved order
  const sorted = (() => {
    const orderedIds = lessonOrder.filter(id => lessons.some(l => l.id === id));
    const unordered = lessons
      .filter(l => !lessonOrder.includes(l.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const ordered = orderedIds.map(id => lessons.find(l => l.id === id)!);
    return [...unordered, ...ordered];
  })();

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(l => l.id)));
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function saveOrder(order: string[]) {
    await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonOrder: order }),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex(l => l.id === active.id);
    const newIndex = sorted.findIndex(l => l.id === over.id);
    const newSorted = arrayMove(sorted, oldIndex, newIndex);
    const newOrder = newSorted.map(l => l.id);

    setLessonOrder(newOrder);
    saveOrder(newOrder);
  }

  async function handleBulkDuplicate() {
    setBulkDuplicating(true);
    const ids = [...selected];
    for (const id of ids) {
      await handleDuplicate(id);
    }
    exitSelecting();
    setBulkDuplicating(false);
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} lesson${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await Promise.all([...selected].map(id => fetch(`/api/lessons/${id}`, { method: "DELETE" })));
    setLessons(prev => prev.filter(l => !selected.has(l.id)));
    exitSelecting();
    setBulkDeleting(false);
  }

  async function loadLessons() {
    const res = await fetch("/api/lessons");
    const data = await res.json();
    setLessons(Array.isArray(data) ? data : []);
  }

  async function loadProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(Array.isArray(data) ? data : []);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lesson?")) return;
    await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    setLessons(prev => prev.filter(l => l.id !== id));
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/lessons/${id}`);
    const lesson = await res.json();
    const { title, subtitle, topics, deadline, overview, learningTargets, warmUp, guidedLab, selfPaced, submissionChecklist, checkpoint, industryBestPractices, slideContent, devJournalPrompt, rubric, taChecklist, sources } = lesson;
    const copy = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Copy of ${title}`, subtitle, topics, deadline, overview, learningTargets, warmUp, guidedLab, selfPaced, submissionChecklist, checkpoint, industryBestPractices, slideContent, devJournalPrompt, rubric: rubric ?? taChecklist ?? "", sources }),
    });
    const newLesson = await copy.json();
    setLessons(prev => [newLesson, ...prev]);
  }

  async function handleGenerateWithOptions(id: string, files: FileChoice[], destination: Destination, templateId?: string) {
    const lesson = lessons.find(l => l.id === id);
    const inProgressStatus = lesson?.status === "done" ? "regenerating" : "generating";
    setLessons(prev => prev.map(l => l.id === id ? { ...l, status: inProgressStatus } : l));

    const res = await fetch(`/api/generate/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files, destination, templateId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setLessons(prev => prev.map(l => l.id === id ? { ...l, status: "error", errorMessage: data.error } : l));
      throw new Error(data.error || "Generation failed");
    }

    if (destination === "drive") {
      const data = await res.json();
      setLessons(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
      await loadProjects();
    } else {
      const { downloads } = await res.json();
      triggerDownloads(downloads);
      setLessons(prev => prev.map(l => l.id === id ? { ...l, status: "done" } : l));
    }
  }

  function triggerDownloads(downloads: { filename: string; data: string }[]) {
    for (const file of downloads) {
      const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      Promise.all([
        loadLessons(),
        loadProjects(),
        fetch("/api/user/settings").then(r => r.json()).then(s => {
          if (Array.isArray(s.lessonOrder)) setLessonOrder(s.lessonOrder);
        }),
      ]).then(() => setLoading(false));
    }
  }, [status]);

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="max-w-md w-full bg-gradient-to-br from-[#0d1c35] to-[#0cc0df] rounded-2xl border border-[#0cc0df]/40 shadow-xl px-8 py-10">
          <div className="flex justify-center mb-5">
            <Image src="/logo.png" alt="NeXTScript" width={200} height={56} className="h-24 w-auto brightness-0 invert" priority />
          </div>
          <p className="text-[#0cc0df] text-base font-medium mb-2">Curriculum Builder</p>
          <p className="text-gray-300 text-sm mb-8">
            Create and edit lessons, then generate a full Google Drive bundle — slides, poster, and quiz — with one click.
          </p>
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition shadow"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff" fillOpacity="0.7"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#ffffff" fillOpacity="0.5"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ffffff" fillOpacity="0.85"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return <p className="text-[#0cc0df] text-sm text-center mt-20">Loading…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 bg-gradient-to-br from-[#0d1c35] to-[#0cc0df] rounded-xl px-5 py-4 shadow">
        <div>
          <h1 className="text-2xl font-bold text-white">Lessons</h1>
          <p className="text-sm text-[#0cc0df] mt-1">Build lessons and generate Drive bundles — slides, docs, and quizzes.</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && sorted.length > 0 && (
            selecting ? (
              <button
                onClick={exitSelecting}
                className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setSelecting(true)}
                className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Select
              </button>
            )
          )}
          <Link
            href="/lessons/new"
            className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition shadow"
          >
            + New Lesson
          </Link>
        </div>
      </div>

      {/* Bulk action bar */}
      {selecting && (
        <div className="flex items-center justify-between mb-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#112543] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              onClick={toggleSelectAll}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-150 ${selected.size === sorted.length && sorted.length > 0 ? "bg-[#0cc0df] border-[#0cc0df]" : selected.size > 0 ? "bg-[#0cc0df]/30 border-[#0cc0df]" : "bg-white dark:bg-[#0d1c35] border-gray-300 dark:border-[#1e4a85]"}`}
            >
              {selected.size === sorted.length && sorted.length > 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#0d1c35]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : selected.size > 0 ? (
                <div className="w-2 h-0.5 bg-[#0d1c35]" />
              ) : null}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {selected.size === 0 ? "Select all" : `${selected.size} of ${sorted.length} selected`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDuplicate}
              disabled={selected.size === 0 || bulkDuplicating}
              className="rounded-md border border-gray-300 dark:border-white/20 bg-white dark:bg-[#1e4a85]/30 px-4 py-1.5 text-sm font-semibold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1e4a85]/50 disabled:opacity-40 transition"
            >
              {bulkDuplicating ? "Duplicating…" : `Duplicate${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selected.size === 0 || bulkDeleting}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition"
            >
              {bulkDeleting ? "Deleting…" : `Delete${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[#0cc0df] text-sm">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">No lessons yet.</p>
          <Link href="/lessons/new" className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
            Create your first lesson
          </Link>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(l => l.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {sorted.map(lesson => (
                <SortableLessonCard
                  key={lesson.id}
                  lesson={lesson}
                  projects={projects.filter(p => p.lessonId === lesson.id)}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onOpenModal={setModalLessonId}
                  selecting={selecting}
                  selected={selected.has(lesson.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <GenerateModal
        lesson={modalLesson}
        onClose={() => setModalLessonId(null)}
        onGenerate={handleGenerateWithOptions}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
