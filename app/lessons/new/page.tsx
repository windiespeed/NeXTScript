"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import LessonForm from "@/components/LessonForm";
import type { LessonInput } from "@/types/lesson";

function NewLessonInner() {
  useSession({ required: true });
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId") ?? undefined;

  const [hasAiKey, setHasAiKey] = useState(false);
  const [defaultSources, setDefaultSources] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const clearFormRef = useRef<(() => void) | undefined>(undefined);

  const backHref = courseId ? `/courses/${courseId}` : "/";

  useEffect(() => {
    Promise.all([
      fetch("/api/user/settings").then((r) => r.json()),
      courseId ? fetch(`/api/courses/${courseId}`).then((r) => r.json()) : Promise.resolve(null),
    ]).then(([userSettings, course]) => {
      setHasAiKey(userSettings.hasKey ?? false);
      // Course settings take priority over profile defaults
      if (course?.settings?.defaultSources) {
        setDefaultSources(course.settings.defaultSources);
      } else {
        setDefaultSources(userSettings.defaultSources ?? "");
      }
    }).catch(() => {
      // Settings fetch failed — render the form anyway with safe defaults
    }).finally(() => {
      setSettingsLoaded(true);
    });
  }, [courseId]);

  async function postLesson(data: LessonInput): Promise<string> {
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, courseId }),
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
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push(backHref)} className="text-sm text-[#0cc0df] hover:underline mb-2 block">
            ← {courseId ? "Back to Course" : "Back to Dashboard"}
          </button>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>New Lesson</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Fill in the sections below. Generate the full Google Drive bundle from the dashboard.
          </p>
        </div>
        <button
          onClick={() => clearFormRef.current?.()}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
          style={{ border: "1px solid var(--border)" }}
        >
          Clear Form
        </button>
      </div>
      {settingsLoaded && (
        <LessonForm
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
          onCancel={() => router.push(backHref)}
          onClearRef={(fn) => { clearFormRef.current = fn; }}
          submitLabel="Create Lesson"
          hasAiKey={hasAiKey}
          initial={{ sources: defaultSources, ...(courseId ? { courseId } : {}) }}
        />
      )}
    </div>
  );
}

export default function NewLessonPage() {
  return (
    <Suspense>
      <NewLessonInner />
    </Suspense>
  );
}
