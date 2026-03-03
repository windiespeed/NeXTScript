"use client";

import Link from "next/link";
import type { Lesson } from "@/types/lesson";

const STATUS_STYLES: Record<Lesson["status"], string> = {
  draft:        "bg-gray-500 text-gray-200",
  generating:   "bg-amber-100 text-amber-800 animate-pulse",
  regenerating: "bg-blue-100 text-blue-800 animate-pulse",
  done:         "bg-emerald-100 text-emerald-800",
  error:        "bg-red-100 text-red-800",
};

const STATUS_ACCENT: Record<Lesson["status"], string> = {
  draft:        "bg-gray-500",
  generating:   "bg-amber-600",
  regenerating: "bg-blue-700",
  done:         "bg-emerald-700",
  error:        "bg-red-700",
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
  onOpenModal: (id: string) => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LessonCard({ lesson, onDelete, onDuplicate, onOpenModal }: Props) {
  const busy = lesson.status === "generating" || lesson.status === "regenerating";

  return (
    <div className="h-full rounded-2xl bg-gray-700 dark:bg-gray-200 flex flex-col overflow-hidden border border-gray-600 dark:border-gray-300 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200">
      {/* Status accent bar */}
      <div className={`h-1 w-full ${STATUS_ACCENT[lesson.status]}`} />

      <div className="flex flex-col gap-3 p-5 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-white dark:text-gray-900 text-base leading-snug">{lesson.title}</h2>
          <span className={`shrink-0 rounded-md px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[lesson.status]}`}>
            {STATUS_LABELS[lesson.status]}
          </span>
        </div>

        {/* Topics tag */}
        {lesson.topics && (
          <p className="self-start rounded-md bg-gray-600 dark:bg-gray-300 px-3 py-0.5 text-xs text-gray-300 dark:text-gray-500 leading-relaxed">
            {lesson.topics}
          </p>
        )}

        {/* Deadline */}
        {lesson.deadline && (
          <p className="text-xs text-gray-300 dark:text-gray-500">
            📅 <span className="font-medium">{lesson.deadline}</span>
          </p>
        )}

        {/* Error message */}
        {lesson.status === "error" && lesson.errorMessage && (
          <p className="rounded-lg bg-red-900/30 border border-red-700 px-3 py-2 text-xs text-red-300 dark:bg-red-50 dark:border-red-100 dark:text-red-600">{lesson.errorMessage}</p>
        )}

        {/* Drive folder link */}
        {lesson.folderUrl && (
          <a
            href={lesson.folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-200 px-3 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 transition"
          >
            📁 Open Drive Folder
          </a>
        )}

        {/* Dates */}
        <div className="mt-auto flex gap-3 text-xs text-gray-400 dark:text-gray-600">
          <span>Created {fmt(lesson.createdAt)}</span>
          {lesson.updatedAt !== lesson.createdAt && (
            <span>· Modified {fmt(lesson.updatedAt)}</span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 px-5 py-3 bg-gray-800 dark:bg-gray-300 border-t border-gray-600 dark:border-gray-300">
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex-1 flex items-center justify-center rounded-lg bg-indigo-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-900 active:scale-95 transition-all duration-150"
        >
          Edit
        </Link>
        <button
          onClick={() => onOpenModal(lesson.id)}
          disabled={busy}
          className="flex-1 flex items-center justify-center rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900 active:scale-95 disabled:opacity-50 transition-all duration-150"
        >
          {busy ? "Running…" : "Generate"}
        </button>
        <button
          onClick={() => onDuplicate(lesson.id)}
          className="flex items-center justify-center rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 active:scale-95 transition-all duration-150"
        >
          Duplicate
        </button>
        <button
          onClick={() => onDelete(lesson.id)}
          className="flex items-center justify-center rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-900 active:scale-95 transition-all duration-150"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
