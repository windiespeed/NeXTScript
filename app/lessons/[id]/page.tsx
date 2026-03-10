"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import LessonForm from "@/components/LessonForm";
import type { Lesson, LessonInput } from "@/types/lesson";

export default function EditLessonPage() {
  useSession({ required: true });
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ url?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch(`/api/lessons/${id}`)
      .then((r) => r.json())
      .then((data) => { setLesson(data); setLoading(false); });
  }, [id]);

  async function handleSubmit(data: LessonInput) {
    const res = await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update lesson.");
    }

    router.push("/");
    router.refresh();
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenResult(null);
    const res = await fetch(`/api/generate/${id}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setGenResult({ error: data.error });
    } else {
      setGenResult({ url: data.folderUrl });
    }
    setGenerating(false);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!lesson) return <p className="text-sm text-red-500">Lesson not found.</p>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Edit Lesson</h1>
          <p className="text-sm text-gray-500 mt-1">{lesson.title}</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="shrink-0 rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {generating ? "Generating…" : "Generate Bundle"}
        </button>
      </div>

      {genResult && (
        <div className={`rounded-md mb-4 p-3 text-sm ${genResult.error ? "bg-red-50 text-red-700" : "bg-[#2dd4a0]/10 border border-[#2dd4a0] text-[#0d1c35]"}`}>
          {genResult.error ? (
            <>Error: {genResult.error}</>
          ) : (
            <>Bundle created! <a href={genResult.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">Open Drive Folder →</a></>
          )}
        </div>
      )}

      <LessonForm initial={lesson} onSubmit={handleSubmit} submitLabel="Save Changes" />
    </main>
  );
}
