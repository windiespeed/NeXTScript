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

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!lesson) return <p className="text-sm text-red-500">Lesson not found.</p>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-white">Edit Lesson</h1>
        <p className="text-sm text-gray-500 mt-1">{lesson.title}</p>
      </div>

      <LessonForm initial={lesson} onSubmit={handleSubmit} onCancel={() => router.push("/")} submitLabel="Save Changes" />
    </main>
  );
}
