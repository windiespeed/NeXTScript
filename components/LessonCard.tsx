"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";
import type { Course } from "@/types/course";

const TYPE_COLOR: Record<NonNullable<Lesson["lessonType"]>, { bg: string; text: string; label: string }> = {
  lesson:     { bg: "rgba(12,192,223,0.12)",   text: "#0cc0df",  label: "Lesson" },
  practice:   { bg: "var(--accent-purple-bg)", text: "var(--accent-purple)", label: "Practice" },
  project:    { bg: "rgba(255,140,74,0.12)",   text: "#ff8c4a",  label: "Project" },
  assessment: { bg: "rgba(45,212,160,0.12)",   text: "#2dd4a0",  label: "Assessment" },
  review:     { bg: "var(--bg-card-hover)",    text: "var(--text-muted)", label: "Review" },
};

const STATUS_BG: Record<Lesson["status"], string> = {
  draft:        "var(--bg-card-hover)",
  generating:   "rgba(255,140,74,0.12)",
  regenerating: "rgba(12,192,223,0.12)",
  done:         "rgba(45,212,160,0.12)",
  error:        "rgba(239,68,68,0.12)",
};

const STATUS_COLOR: Record<Lesson["status"], string> = {
  draft:        "var(--text-muted)",
  generating:   "#ff8c4a",
  regenerating: "#0cc0df",
  done:         "#2dd4a0",
  error:        "#ef4444",
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
  courses?: Course[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenModal: (id: string) => void;
  onAssign?: (lessonId: string, courseId: string | null) => void;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  gripProps?: React.HTMLAttributes<HTMLDivElement>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LessonCard({ lesson, projects = [], courses, onDelete, onDuplicate, onOpenModal, onAssign, selecting = false, selected = false, onToggleSelect, gripProps }: Props) {
  const busy = lesson.status === "generating" || lesson.status === "regenerating";
  const deck = projects.find(p => p.type === "deck");
  const form = projects.find(p => p.type === "form");
  const [showCourseMenu, setShowCourseMenu] = useState(false);
  const courseMenuRef = useRef<HTMLDivElement>(null);
  const assignedCourse = courses?.find(c => c.id === lesson.courseId);

  useEffect(() => {
    if (!showCourseMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (courseMenuRef.current && !courseMenuRef.current.contains(e.target as Node)) {
        setShowCourseMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCourseMenu]);

  return (
    <div
      onClick={selecting ? () => onToggleSelect?.(lesson.id) : undefined}
      className={`group relative h-full rounded-3xl flex flex-col transition-all duration-200 ${selecting ? "cursor-pointer" : "hover:-translate-y-1 hover:shadow-lg"} ${selected ? "ring-2 ring-[#0cc0df]/60" : selecting ? "opacity-50" : ""}`}
      style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Selection checkbox */}
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

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Title + icon actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link
              href={assignedCourse ? `/courses/${assignedCourse.id}` : `/lessons/${lesson.id}`}
              className="font-semibold text-sm leading-snug hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              {lesson.title}
            </Link>
            {lesson.subtitle && (
              <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{lesson.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {!selecting && gripProps && (
              <div
                {...gripProps}
                title="Drag to reorder"
                className="p-1.5 rounded-full transition cursor-grab active:cursor-grabbing"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Status + deadline + course dropdown */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
            style={{ background: STATUS_BG[lesson.status], color: STATUS_COLOR[lesson.status] }}
          >
            {STATUS_LABELS[lesson.status]}
          </span>
          {lesson.lessonType && lesson.lessonType !== "lesson" && (() => {
            const t = TYPE_COLOR[lesson.lessonType];
            return (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: t.bg, color: t.text }}>
                {t.label}
              </span>
            );
          })()}
          {lesson.deadline && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(255,140,74,0.12)", color: "#ff8c4a" }}>
              Due {lesson.deadline}
            </span>
          )}
          {courses && onAssign && !selecting && (
            <div className="relative" ref={courseMenuRef}>
              <button
                onClick={() => setShowCourseMenu(v => !v)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition hover:opacity-80"
                style={assignedCourse
                  ? { background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }
                  : { background: "var(--bg-card-hover)", color: "var(--text-muted)", border: "1px dashed var(--border)" }
                }
              >
                {assignedCourse ? assignedCourse.title : "Unassigned"}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {showCourseMenu && (
                <div className="absolute left-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[180px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                  <button
                    onClick={() => { onAssign(lesson.id, null); setShowCourseMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No course
                  </button>
                  {courses.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { onAssign(lesson.id, c.id); setShowCourseMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                      style={{ color: c.id === lesson.courseId ? "var(--accent-purple)" : "var(--text-primary)", fontWeight: c.id === lesson.courseId ? 600 : 400 }}
                    >
                      {c.id === lesson.courseId ? "✓ " : ""}{c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Topics + dates */}
        <div className="flex flex-col gap-1.5 mt-auto pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {lesson.topics && (
            <p className="text-xs leading-relaxed line-clamp-1" style={{ color: "var(--text-secondary)" }}>
              {lesson.topics}
            </p>
          )}
          <div className="flex gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span>Created {fmt(lesson.createdAt)}</span>
            {lesson.updatedAt !== lesson.createdAt && (
              <span>· Modified {fmt(lesson.updatedAt)}</span>
            )}
          </div>
        </div>

        {/* Error message */}
        {lesson.status === "error" && lesson.errorMessage && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-500">{lesson.errorMessage}</p>
        )}
      </div>

      {/* Asset pills */}
      {(deck || form || lesson.folderUrl) && (
        <div className="px-5 pt-3 pb-4 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="w-full text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--sidebar-label)" }}>Assets</p>
          {deck && (
            <Link
              href={`/slides?lessonId=${lesson.id}`}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80"
              style={{ background: "rgba(12,192,223,0.10)", color: "#0cc0df" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Slides
            </Link>
          )}
          {form && (
            <Link
              href={`/forms?lessonId=${lesson.id}`}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80"
              style={{ background: "rgba(255,140,74,0.10)", color: "#ff8c4a" }}
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
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:opacity-80"
              style={{ background: "rgba(45,212,160,0.10)", color: "#2dd4a0" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Drive ↗
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-2">
        <Link
          href={`/lessons/${lesson.id}`}
          className="flex-1 flex items-center justify-center rounded-full bg-[#0cc0df] py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 active:scale-95 transition-all duration-150"
        >
          Edit
        </Link>
        <button
          onClick={() => onDuplicate(lesson.id)}
          title="Duplicate"
          className="p-2 rounded-full transition hover:bg-[var(--bg-card-hover)] active:scale-95"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button
          onClick={() => onDelete(lesson.id)}
          title="Delete"
          className="p-2 rounded-full transition hover:bg-red-500/10 hover:text-red-500 active:scale-95"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  );
}
