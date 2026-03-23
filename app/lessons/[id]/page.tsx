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
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<"idle" | "done" | "error">("idle");
  const [generateMsg, setGenerateMsg] = useState("");
  const [includeOverview, setIncludeOverview] = useState(true);

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

  async function handleGenerate() {
    if (!lesson) return;
    setGenerating(true);
    setGenerateStatus("idle");
    setGenerateMsg("");
    const files = includeOverview ? ["slides", "doc"] : ["slides"];
    try {
      const res = await fetch(`/api/generate/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, destination: "drive" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setLesson(prev => prev ? { ...prev, ...data } : prev);
      setGenerateStatus("done");
      setGenerateMsg(data.folderUrl ? "Generated! Files saved to Drive." : "Generated successfully.");
    } catch (err: any) {
      setGenerateStatus("error");
      setGenerateMsg(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading…</p>;
  if (!lesson) return <p className="text-sm text-red-500 mt-10">Lesson not found.</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-4">
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
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => clearFormRef.current?.()}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
              style={{ border: "1px solid var(--border)" }}
            >
              Clear Form
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
            >
              {generating ? "Generating…" : lesson.status === "done" ? "Regenerate Slides" : "Generate Slides"}
            </button>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeOverview}
              onChange={e => setIncludeOverview(e.target.checked)}
              className="w-3 h-3 accent-[#0cc0df]"
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Include Overview Doc</span>
          </label>
          {generateStatus === "done" && (
            <p className="text-xs text-[#2dd4a0]">{generateMsg}</p>
          )}
          {generateStatus === "error" && (
            <p className="text-xs text-red-500">{generateMsg}</p>
          )}
          {lesson.folderUrl && generateStatus === "idle" && (
            <a href={lesson.folderUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0cc0df] hover:underline">
              View in Drive ↗
            </a>
          )}
        </div>
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
