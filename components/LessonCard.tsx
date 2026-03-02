"use client";

import Link from "next/link";
import type { Lesson } from "@/types/lesson";

const STATUS_STYLES: Record<Lesson["status"], string> = {
  draft:        "bg-gray-100 text-gray-600",
  generating:   "bg-yellow-100 text-yellow-700 animate-pulse",
  regenerating: "bg-blue-100 text-blue-700 animate-pulse",
  done:         "bg-green-100 text-green-700",
  error:        "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<Lesson["status"], string> = {
  draft:        "Draft",
  generating:   "⏳ Generating…",
  regenerating: "🔄 Regenerating…",
  done:         "✅ Done",
  error:        "❌ Error",
};

interface Props {
  lesson: Lesson;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onGenerate: (id: string) => void;
}

export default function LessonCard({ lesson, onDelete, onDuplicate, onGenerate }: Props) {
  const busy = lesson.status === "generating" || lesson.status === "regenerating";

  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900 text-base leading-tight">{lesson.title}</h2>
          {lesson.topics && (
            <p className="text-xs text-gray-500 mt-0.5">{lesson.topics}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[lesson.status]}`}>
          {STATUS_LABELS[lesson.status]}
        </span>
      </div>

      {lesson.deadline && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">Deadline:</span> {lesson.deadline}
        </p>
      )}

      {lesson.status === "error" && lesson.errorMessage && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600">{lesson.errorMessage}</p>
      )}

      {lesson.folderUrl && (
        <a
          href={lesson.folderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 hover:underline"
        >
          Open Drive Folder →
        </a>
      )}

      <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100 items-center">
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex-1 flex items-center justify-center rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
        >
          Edit
        </Link>
        <button
          onClick={() => onGenerate(lesson.id)}
          disabled={busy}
          className="flex-1 flex items-center justify-center rounded-md bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 transition"
        >
          {busy ? "Running…" : "Generate"}
        </button>
        <button
          onClick={() => onDuplicate(lesson.id)}
          className="flex items-center justify-center rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
        >
          Duplicate
        </button>
        <button
          onClick={() => onDelete(lesson.id)}
          className="flex items-center justify-center rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
