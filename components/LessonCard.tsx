"use client";

import Link from "next/link";
import React from "react";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";

const STATUS_DOT: Record<Lesson["status"], string> = {
  draft:        "bg-[var(--text-muted)]",
  generating:   "bg-[#ff8c4a] animate-pulse",
  regenerating: "bg-[#0cc0df] animate-pulse",
  done:         "bg-[#2dd4a0]",
  error:        "bg-red-500",
};

const STATUS_TEXT: Record<Lesson["status"], string> = {
  draft:        "text-[var(--text-secondary)]",
  generating:   "text-[#ff8c4a]",
  regenerating: "text-[#0cc0df]",
  done:         "text-[#2dd4a0]",
  error:        "text-red-500",
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
  gripProps?: React.HTMLAttributes<HTMLDivElement>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LessonCard({ lesson, projects = [], onDelete, onDuplicate, onOpenModal, selecting = false, selected = false, onToggleSelect, gripProps }: Props) {
  const busy = lesson.status === "generating" || lesson.status === "regenerating";
  const deck = projects.find(p => p.type === "deck");
  const form = projects.find(p => p.type === "form");

  return (
    <div
      onClick={selecting ? () => onToggleSelect?.(lesson.id) : undefined}
      className={`relative h-full rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ${selecting ? "cursor-pointer" : "hover:-translate-y-1 hover:shadow-lg"} ${selected ? "ring-2 ring-[#0cc0df]/60 opacity-100" : selecting ? "opacity-50" : ""}`}
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      {selecting && (
        <div className="absolute top-3 right-3 z-10" onClick={e => e.stopPropagation()}>
          <div
            onClick={() => onToggleSelect?.(lesson.id)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-150 ${selected ? "bg-[#0cc0df] border-[#0cc0df] shadow-sm" : "border-[var(--border)]"}`}
            style={selected ? {} : { background: "var(--bg-body)" }}
          >
            {selected && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#0a0b13]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            <h2 className="font-semibold text-base leading-snug" style={{ color: "var(--text-primary)" }}>{lesson.title}</h2>
            {lesson.subtitle && (
              <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-secondary)" }}>{lesson.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onDelete(lesson.id)}
              title="Delete"
              className="p-1.5 rounded-lg transition hover:text-red-500 hover:bg-red-500/10"
              style={{ color: "var(--text-muted)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
            {!selecting && gripProps && (
              <div
                {...gripProps}
                title="Drag to reorder"
                className="p-1.5 rounded-lg transition cursor-grab active:cursor-grabbing"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_TEXT[lesson.status]}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[lesson.status]}`} />
            {STATUS_LABELS[lesson.status]}
          </span>
          {lesson.deadline && (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Due <span className="font-medium" style={{ color: "var(--text-primary)" }}>{lesson.deadline}</span>
            </span>
          )}
        </div>

        {/* Error message */}
        {lesson.status === "error" && lesson.errorMessage && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-500">{lesson.errorMessage}</p>
        )}
      </div>

      {/* Asset pills */}
      {(deck || form || lesson.folderUrl) && (
        <div className="px-4 pb-1 pt-1 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          {deck && (
            <Link
              href={`/slides?lessonId=${lesson.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition hover:bg-[#0cc0df]/15 hover:text-[#0cc0df]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Slides
            </Link>
          )}
          {form && (
            <Link
              href={`/forms?lessonId=${lesson.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition hover:bg-[#ff8c4a]/15 hover:text-[#ff8c4a]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Quiz
            </Link>
          )}
          {lesson.folderUrl && (
            <a
              href={lesson.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition hover:bg-[var(--bg-card-hover)] hover:text-[#0cc0df]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Drive Folder ↗
            </a>
          )}
        </div>
      )}

      {/* Topics + Dates shaded block */}
      <div className="px-5 py-3 flex flex-col gap-2" style={{ background: "var(--bg-card-hover)", borderTop: "1px solid var(--border)" }}>
        <p className="text-xs leading-relaxed line-clamp-3 h-[3.75rem]" style={{ color: "var(--text-secondary)" }}>
          {lesson.topics || ""}
        </p>
        <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Created {fmt(lesson.createdAt)}</span>
          {lesson.updatedAt !== lesson.createdAt && (
            <span>· Modified {fmt(lesson.updatedAt)}</span>
          )}
        </div>
      </div>

      {/* Primary actions */}
      <div className="flex gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => onDuplicate(lesson.id)}
          className="flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold active:scale-95 transition-all duration-150 hover:bg-[var(--bg-card-hover)]"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Duplicate
        </button>
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex-1 flex items-center justify-center rounded-xl bg-[#0cc0df] px-3 py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 active:scale-95 transition-all duration-150"
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
