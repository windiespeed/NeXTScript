"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LessonCard from "@/components/LessonCard";
import ProjectCard from "@/components/ProjectCard";
import GenerateModal from "@/components/GenerateModal";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";

type Tab = "lessons" | "decks" | "forms";

type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";

function Dashboard() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalLessonId, setModalLessonId] = useState<string | null>(null);

  const tabParam = searchParams.get("tab");
  const tab: Tab = (tabParam === "decks" || tabParam === "forms") ? tabParam : "lessons";

  function switchTab(t: Tab) {
    router.replace(t === "lessons" ? "/" : `/?tab=${t}`, { scroll: false });
  }

  const modalLesson = lessons.find(l => l.id === modalLessonId) ?? null;
  const decks = projects.filter(p => p.type === "deck");
  const forms = projects.filter(p => p.type === "form");

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
    setLessons((prev) => prev.filter((l) => l.id !== id));
  }

  function handleOpenModal(id: string) {
    setModalLessonId(id);
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
    setLessons((prev) => [...prev, newLesson]);
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  useEffect(() => {
    if (status === "authenticated") {
      Promise.all([loadLessons(), loadProjects()]).then(() => setLoading(false));
    }
  }, [status]);

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="max-w-md w-full bg-gradient-to-br from-[#1b2d4f] to-[#1a9bbf] rounded-2xl border border-[#1a9bbf]/40 shadow-xl px-8 py-10">
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

  const tabBtn = (t: Tab, label: string, count: number) => (
    <button
      onClick={() => switchTab(t)}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
        tab === t
          ? "bg-[#0cc0df] text-[#112543] shadow"
          : "text-gray-300 hover:text-white hover:bg-[#1e4a85]"
      }`}
    >
      {label} {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
    </button>
  );

  const newHref = tab === "lessons" ? "/lessons/new" : tab === "decks" ? "/slides/new" : "/forms/new";
  const newLabel = tab === "lessons" ? "+ New Lesson" : tab === "decks" ? "+ New Deck" : "+ New Form";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 bg-gradient-to-br from-[#1b2d4f] to-[#1a9bbf] rounded-xl px-5 py-4 shadow">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-[#0cc0df] mt-1">Build lessons, slide decks, and forms.</p>
        </div>
        <Link
          href={newHref}
          className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition shadow"
        >
          {newLabel}
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#112543] rounded-lg p-1 w-fit shadow">
        {tabBtn("lessons", "Lessons", lessons.length)}
        {tabBtn("decks", "Slide Decks", decks.length)}
        {tabBtn("forms", "Forms", forms.length)}
      </div>

      {loading ? (
        <p className="text-[#0cc0df] text-sm">Loading…</p>
      ) : tab === "lessons" ? (
        lessons.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#1e4a85] p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No lessons yet.</p>
            <Link href="/lessons/new" className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
              Create your first lesson
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {lessons.map(lesson => (
              <LessonCard key={lesson.id} lesson={lesson} onDelete={handleDelete} onDuplicate={handleDuplicate} onOpenModal={handleOpenModal} />
            ))}
          </div>
        )
      ) : tab === "decks" ? (
        decks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#1e4a85] p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No slide decks yet.</p>
            <Link href="/slides/new" className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
              Create your first slide deck
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {decks.map(p => <ProjectCard key={p.id} project={p} onDelete={handleDeleteProject} />)}
          </div>
        )
      ) : (
        forms.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#1e4a85] p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No forms yet.</p>
            <Link href="/forms/new" className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
              Create your first form
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {forms.map(p => <ProjectCard key={p.id} project={p} onDelete={handleDeleteProject} />)}
          </div>
        )
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
