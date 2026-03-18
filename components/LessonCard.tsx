"use client";

import Link from "next/link";
import { useState } from "react";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";

const STATUS_DOT: Record<Lesson["status"], string> = {
  draft:        "bg-[#1e4a85]",
  generating:   "bg-amber-400 animate-pulse",
  regenerating: "bg-[#0cc0df] animate-pulse",
  done:         "bg-[#2dd4a0]",
  error:        "bg-red-500",
};

const STATUS_TEXT: Record<Lesson["status"], string> = {
  draft:        "text-[#1e4a85] dark:text-[#7eb3f5]",
  generating:   "text-amber-600 dark:text-amber-400",
  regenerating: "text-[#006f8a] dark:text-[#0cc0df]",
  done:         "text-[#0d7a5c] dark:text-[#2dd4a0]",
  error:        "text-red-600 dark:text-red-400",
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
  projects?: SavedProject[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenModal: (id: string) => void;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LessonCard({ lesson, projects = [], onDelete, onDuplicate, onOpenModal, selecting = false, selected = false, onToggleSelect }: Props) {
  const busy = lesson.status === "generating" || lesson.status === "regenerating";
  const [assetsOpen, setAssetsOpen] = useState(false);
  const deck = projects.find(p => p.type === "deck");
  const form = projects.find(p => p.type === "form");

  return (
    <div
      onClick={selecting ? () => onToggleSelect?.(lesson.id) : undefined}
      className={`relative h-full rounded-2xl bg-white dark:bg-[#112543] flex flex-col overflow-hidden border shadow-sm transition-all duration-200 ${selecting ? "cursor-pointer" : "hover:-translate-y-1 hover:shadow-md"} ${selected ? "border-[#0cc0df] ring-2 ring-[#0cc0df]/30 opacity-100" : selecting ? "border-gray-200 dark:border-[#1e4a85]/30 opacity-50" : "border-gray-200 dark:border-[#1e4a85]/30"}`}
    >
      {selecting && (
        <div
          className="absolute top-3 right-3 z-10"
          onClick={e => e.stopPropagation()}
        >
          <div
            onClick={() => onToggleSelect?.(lesson.id)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-150 ${selected ? "bg-[#0cc0df] border-[#0cc0df] shadow-sm" : "bg-white dark:bg-[#0d1c35] border-gray-300 dark:border-[#1e4a85]"}`}
          >
            {selected && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#0d1c35]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 p-5 flex-1">

        {/* Title + icon actions row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[#0d1c35] dark:text-white text-base leading-snug">{lesson.title}</h2>
            {lesson.subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{lesson.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Duplicate */}
            <button
              onClick={() => onDuplicate(lesson.id)}
              title="Duplicate"
              className="p-1.5 rounded-lg text-gray-500 hover:text-[#1e4a85] dark:hover:text-[#7eb3f5] hover:bg-gray-100 dark:hover:bg-[#1e4a85]/20 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            {/* Delete */}
            <button
              onClick={() => onDelete(lesson.id)}
              title="Delete"
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_TEXT[lesson.status]}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[lesson.status]}`} />
            {STATUS_LABELS[lesson.status]}
          </span>
          {lesson.deadline && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Due <span className="font-medium text-gray-600 dark:text-gray-300">{lesson.deadline}</span>
            </span>
          )}
        </div>

        {/* Topics */}
        {lesson.topics && (
          <p className="-mx-5 bg-[#0cc0df]/8 dark:bg-[#0d1c35] border-y border-[#0cc0df]/20 dark:border-[#0cc0df]/10 px-5 py-1.5 text-xs text-[#006f8a] dark:text-[#0cc0df] leading-relaxed">
            {lesson.topics}
          </p>
        )}

        {/* Error message */}
        {lesson.status === "error" && lesson.errorMessage && (
          <p className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-300">{lesson.errorMessage}</p>
        )}

{/* Dates */}
        <div className="mt-auto flex gap-3 text-xs text-gray-500 dark:text-gray-400 pt-1">
          <span>Created {fmt(lesson.createdAt)}</span>
          {lesson.updatedAt !== lesson.createdAt && (
            <span>· Modified {fmt(lesson.updatedAt)}</span>
          )}
        </div>
      </div>

      {/* Assets row */}
      {(deck || form || lesson.folderUrl) && (
        <div className="border-t border-gray-100 dark:border-white/5">
          <button
            onClick={() => setAssetsOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-[#0d1c35] dark:hover:text-white transition"
          >
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              Generated Assets
              <span className="rounded-full bg-gray-100 dark:bg-[#1e4a85]/30 px-1.5 py-0.5 text-[10px]">
                {[deck, form, lesson.folderUrl].filter(Boolean).length}
              </span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${assetsOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {assetsOpen && (
            <div className="px-4 pb-3 flex flex-col gap-1.5">
              {deck && (
                <a href={deck.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-[#1e4a85]/30 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:border-[#0cc0df] hover:text-[#006f8a] dark:hover:text-[#0cc0df] transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  Slide Deck
                </a>
              )}
              {form && (
                <a href={form.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-[#1e4a85]/30 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:border-[#0cc0df] hover:text-[#006f8a] dark:hover:text-[#0cc0df] transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  Quiz Form
                </a>
              )}
              {lesson.folderUrl && (
                <a href={lesson.folderUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-[#1e4a85]/30 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:border-[#0cc0df] hover:text-[#006f8a] dark:hover:text-[#0cc0df] transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  Drive Folder
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Primary actions */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-100 dark:border-white/5">
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex-1 flex items-center justify-center rounded-xl bg-gray-200 dark:bg-[#1e4a85]/60 px-3 py-2 text-xs font-semibold text-[#0d1c35] dark:text-white hover:bg-gray-300 dark:hover:bg-[#1e4a85]/80 transition"
        >
          Edit
        </Link>
        <button
          onClick={() => onOpenModal(lesson.id)}
          disabled={busy}
          className="flex-1 flex items-center justify-center rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all duration-150"
        >
          {busy ? "Running…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
