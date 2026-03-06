"use client";

import Link from "next/link";
import type { Lesson } from "@/types/lesson";

const STATUS_STYLES: Record<Lesson["status"], string> = {
  draft:        "bg-[#1e4a85]/60 text-gray-200",
  generating:   "bg-amber-100 text-amber-800 animate-pulse",
  regenerating: "bg-[#0cc0df]/20 text-[#0cc0df] animate-pulse",
  done:         "bg-[#2dd4a0]/20 text-[#2dd4a0]",
  error:        "bg-red-100 text-red-800",
};

const STATUS_ACCENT: Record<Lesson["status"], string> = {
  draft:        "bg-[#1e4a85]",
  generating:   "bg-amber-500",
  regenerating: "bg-[#0cc0df]",
  done:         "bg-[#2dd4a0]",
  error:        "bg-red-500",
};

const STATUS_LABELS: Record<Lesson["status"], string> = {
  draft:        "Draft",
  generating:   "Generating…",
  regenerating: "Regenerating…",
  done:         "Done",
  error:        "Error",
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
    <div className="h-full rounded-2xl bg-[#112543] dark:bg-gradient-to-br dark:from-[#1b2d4f] dark:to-[#1a9bbf] flex flex-col overflow-hidden border border-[#1e4a85] shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
      {/* Status accent bar */}
      <div className={`h-1 w-full ${STATUS_ACCENT[lesson.status]}`} />

      <div className="flex flex-col gap-3 p-5 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-white text-base leading-snug">{lesson.title}</h2>
          <span className={`shrink-0 rounded-md px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[lesson.status]}`}>
            {STATUS_LABELS[lesson.status]}
          </span>
        </div>

        {/* Topics tag */}
        {lesson.topics && (
          <p className="self-start rounded-md bg-[#0d1c35] px-3 py-0.5 text-xs text-[#0cc0df] leading-relaxed">
            {lesson.topics}
          </p>
        )}

        {/* Deadline */}
        {lesson.deadline && (
          <p className="text-xs text-gray-300">
            <span className="font-medium">{lesson.deadline}</span>
          </p>
        )}

        {/* Error message */}
        {lesson.status === "error" && lesson.errorMessage && (
          <p className="rounded-lg bg-red-900/30 border border-red-700 px-3 py-2 text-xs text-red-300">{lesson.errorMessage}</p>
        )}

        {/* Drive folder link */}
        {lesson.folderUrl && (
          <a
            href={lesson.folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start inline-flex items-center gap-1 rounded-md border border-[#0cc0df]/40 bg-[#0cc0df]/10 px-3 py-0.5 text-xs font-medium text-[#0cc0df] hover:bg-[#0cc0df]/20 transition"
          >
            Open Drive Folder
          </a>
        )}

        {/* Dates */}
        <div className="mt-auto flex gap-3 text-xs text-gray-400">
          <span>Created {fmt(lesson.createdAt)}</span>
          {lesson.updatedAt !== lesson.createdAt && (
            <span>· Modified {fmt(lesson.updatedAt)}</span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 px-5 py-3 border-t border-white/10">
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex-1 flex items-center justify-center rounded-lg bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#112543] hover:opacity-90 active:scale-95 transition-all duration-150"
        >
          Edit
        </Link>
        <button
          onClick={() => onOpenModal(lesson.id)}
          disabled={busy}
          className="flex-1 flex items-center justify-center rounded-lg bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all duration-150"
        >
          {busy ? "Running…" : "Generate"}
        </button>
        <button
          onClick={() => onDuplicate(lesson.id)}
          className="flex items-center justify-center rounded-lg bg-[#1e4a85] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a5a9a] active:scale-95 transition-all duration-150"
        >
          Duplicate
        </button>
        <button
          onClick={() => onDelete(lesson.id)}
          className="flex items-center justify-center rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 active:scale-95 transition-all duration-150"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
