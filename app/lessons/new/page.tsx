"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import LessonForm from "@/components/LessonForm";
import type { LessonInput } from "@/types/lesson";

export default function NewLessonPage() {
  useSession({ required: true });
  const router = useRouter();
  const [hasAiKey, setHasAiKey] = useState(false);
  const [defaultSources, setDefaultSources] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        setHasAiKey(data.hasKey ?? false);
        setDefaultSources(data.defaultSources ?? "");
        setSettingsLoaded(true);
      });
  }, []);

  async function postLesson(data: LessonInput): Promise<string> {
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create lesson.");
    }
    const lesson = await res.json();
    return lesson.id as string;
  }

  async function handleSaveDraft(data: LessonInput) {
    const id = await postLesson(data);
    router.replace(`/lessons/${id}`);
  }

  async function handleSubmit(data: LessonInput) {
    await postLesson(data);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-white">New Lesson</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the sections below. Generate the full Google Drive bundle from the dashboard.</p>
      </div>
      {settingsLoaded && <LessonForm onSubmit={handleSubmit} onSaveDraft={handleSaveDraft} onCancel={() => router.push("/")} submitLabel="Create Lesson" hasAiKey={hasAiKey} initial={{ sources: defaultSources }} />}
    </main>
  );
}
