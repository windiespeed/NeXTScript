"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LessonCard from "@/components/LessonCard";
import type { Lesson } from "@/types/lesson";

export default function DashboardPage() {
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
    loadLessons();
  }, []);

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
