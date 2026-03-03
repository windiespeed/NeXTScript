"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import LessonCard from "@/components/LessonCard";
import type { Lesson } from "@/types/lesson";

export default function DashboardPage() {
  const { status } = useSession();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLessons() {
    const res = await fetch("/api/lessons");
    const data = await res.json();
    setLessons(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lesson?")) return;
    await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    setLessons((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleGenerate(id: string) {
    const lesson = lessons.find((l) => l.id === id);
    const inProgressStatus = lesson?.status === "done" ? "regenerating" : "generating";
    // Optimistically show in-progress status immediately
    setLessons((prev) => prev.map((l) => l.id === id ? { ...l, status: inProgressStatus } : l));
    const res = await fetch(`/api/generate/${id}`, { method: "POST" });
    const data = await res.json();
    // Update with the final result from the server
    setLessons((prev) => prev.map((l) => l.id === id ? { ...l, ...data } : l));
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/lessons/${id}`);
    const lesson = await res.json();
    const { title, subtitle, topics, deadline, overview, learningTargets, warmUp, guidedLab, selfPaced, submissionChecklist, checkpoint, industryBestPractices, slideContent, devJournalPrompt, taChecklist, sources } = lesson;
    const copy = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Copy of ${title}`, subtitle, topics, deadline, overview, learningTargets, warmUp, guidedLab, selfPaced, submissionChecklist, checkpoint, industryBestPractices, slideContent, devJournalPrompt, taChecklist, sources }),
    });
    const newLesson = await copy.json();
    setLessons((prev) => [...prev, newLesson]);
  }

  useEffect(() => {
    if (status === "authenticated") loadLessons();
  }, [status]);

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold text-blue-900 mb-2">NeXTScript</h1>
          <p className="text-gray-500 text-lg mb-2">Curriculum Builder</p>
          <p className="text-gray-400 text-sm mb-8">
            Create and edit lessons, then generate a full Google Drive bundle — slides, poster, and quiz — with one click.
          </p>
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center gap-3 rounded-lg bg-blue-900 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 transition shadow"
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
    return <p className="text-gray-500 text-sm text-center mt-20">Loading…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 bg-gray-700 rounded-xl px-5 py-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Lesson Dashboard</h1>
          <p className="text-sm text-white mt-1">
            Build a lesson, then click Generate to push a full bundle to Google Drive.
          </p>
        </div>
        <Link
          href="/lessons/new"
          className="rounded-md bg-white px-4 py-2 text-sm font-bold text-blue-900 hover:bg-gray-100 transition"
        >
          + New Lesson
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading lessons…</p>
      ) : lessons.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No lessons yet.</p>
          <Link
            href="/lessons/new"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition"
          >
            Create your first lesson
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} onDelete={handleDelete} onDuplicate={handleDuplicate} onGenerate={handleGenerate} />
          ))}
        </div>
      )}
    </div>
  );
}
