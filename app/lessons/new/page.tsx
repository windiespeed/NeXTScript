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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-white">New Lesson</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the sections below. Generate the full Google Drive bundle from the dashboard.</p>
      </div>
      <LessonForm onSubmit={handleSubmit} onCancel={() => router.push("/")} submitLabel="Create Lesson" />
    </main>
  );
}
