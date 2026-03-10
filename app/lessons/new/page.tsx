"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import LessonForm from "@/components/LessonForm";
import type { LessonInput } from "@/types/lesson";

export default function NewLessonPage() {
  useSession({ required: true });
  const router = useRouter();

  async function handleSubmit(data: LessonInput) {
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create lesson.");
    }

    router.push("/");
    router.refresh();
  }

  async function handleBundle(data: LessonInput): Promise<{ folderUrl: string }> {
    const saveRes = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.error || "Failed to create lesson.");
    }
    const lesson = await saveRes.json();

    const genRes = await fetch(`/api/generate/${lesson.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: ["slides", "doc", "quiz"], destination: "drive" }),
    });
    if (!genRes.ok) {
      const err = await genRes.json();
      throw new Error(err.error || "Generation failed.");
    }
    const { folderUrl } = await genRes.json();
    router.push("/");
    router.refresh();
    return { folderUrl };
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-white">New Lesson</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the sections below. Generate the full Google Drive bundle from the dashboard.</p>
      </div>
      <LessonForm onSubmit={handleSubmit} onBundle={handleBundle} onCancel={() => router.push("/")} submitLabel="Create Lesson" />
    </main>
  );
}
