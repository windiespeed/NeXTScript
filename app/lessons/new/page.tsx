"use client";

import { useRouter } from "next/navigation";
import LessonForm from "@/components/LessonForm";
import type { LessonInput } from "@/types/lesson";

export default function NewLessonPage() {
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
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 bg-gray-700 rounded-xl px-5 py-4">
        <h1 className="text-2xl font-bold text-white">New Lesson</h1>
        <p className="text-sm text-white mt-1">
          Fill in the sections below. You can generate the full Google Drive bundle from the dashboard.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <LessonForm onSubmit={handleSubmit} submitLabel="Create Lesson" />
      </div>
    </div>
  );
}
