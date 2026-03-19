"use client";

import { useEffect, useRef, useState } from "react";
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
  const [hasAiKey, setHasAiKey] = useState(false);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const clearFormRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      fetch(`/api/lessons/${id}`).then((r) => r.json()),
      fetch("/api/user/settings").then((r) => r.json()),
    ]).then(([lessonData, settings]) => {
      setLesson(lessonData);
      setHasAiKey(settings.hasKey ?? false);
      if (lessonData?.courseId) {
        fetch(`/api/courses/${lessonData.courseId}`).then(r => r.json()).then(c => {
          if (c?.title) setCourseTitle(c.title);
        }).catch(() => {});
      }
    }).catch(() => {
      // Fetch failed — render form without AI key
    }).finally(() => {
      setLoading(false);
    });
  }, [id]);

  const backHref = lesson?.courseId ? `/courses/${lesson.courseId}` : "/";

  async function putLesson(data: LessonInput) {
    const res = await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update lesson.");
    }
  }

  async function handleSubmit(data: LessonInput) {
    await putLesson(data);
    router.push(backHref);
    router.refresh();
  }

  async function handleAutoSave(data: LessonInput) {
    await putLesson(data);
  }

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading…</p>;
  if (!lesson) return <p className="text-sm text-red-500 mt-10">Lesson not found.</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push(backHref)} className="text-sm text-[#0cc0df] hover:underline mb-2 block">
            ← {lesson.courseId ? "Back to Course" : "Back to Dashboard"}
          </button>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Edit Lesson</h1>
          {courseTitle && (
            <span className="inline-flex items-center gap-1.5 mt-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              {courseTitle}
            </span>
          )}
        </div>
        <button
          onClick={() => clearFormRef.current?.()}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
          style={{ border: "1px solid var(--border)" }}
        >
          Clear Form
        </button>
      </div>

      <LessonForm
        initial={lesson}
        onSubmit={handleSubmit}
        autoSave={handleAutoSave}
        onCancel={() => router.push(backHref)}
        onClearRef={(fn) => { clearFormRef.current = fn; }}
        submitLabel="Save Changes"
        hasAiKey={hasAiKey}
        isEditing
      />
    </div>
  );
}
