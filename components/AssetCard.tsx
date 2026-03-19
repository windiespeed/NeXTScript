"use client";

import type { SavedProject } from "@/types/project";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const DECK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const FORM_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

interface Props {
  project: SavedProject;
  onDelete: (id: string) => void;
}

export default function AssetCard({ project, onDelete }: Props) {
  const isDeck = project.type === "deck";
  const isQuiz = !isDeck && project.isQuiz;

  const typeLabel = isDeck ? "Slide Deck" : isQuiz ? "Quiz" : "Form";
  const accentBar = isDeck ? "bg-[#0cc0df]" : "bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e]";
  const iconBg    = isDeck ? "bg-[#0cc0df]/15 text-[#0cc0df]" : "bg-[#ff8c4a]/15 text-[#ff8c4a]";
  const badgeBg   = isDeck ? "bg-[#0cc0df]/10 text-[#0cc0df]" : "bg-[#ff8c4a]/10 text-[#ff8c4a]";
  const openLabel = isDeck ? "Open in Slides" : "Open in Forms";

  return (
    <div
      className="h-full rounded-3xl flex flex-col overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Top accent */}
      <div className={`h-1 w-full shrink-0 ${accentBar}`} />

      <div className="flex flex-col gap-3 p-5 flex-1">
        {/* Icon + type badge row */}
        <div className="flex items-center justify-between gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
            {isDeck ? DECK_ICON : FORM_ICON}
          </div>
          <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-semibold ${badgeBg}`}>
            {typeLabel}
          </span>
        </div>

        {/* Title */}
        <div>
          <h2 className="font-semibold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
            {project.title}
          </h2>
          {project.subtitle && (
            <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-secondary)" }}>
              {project.subtitle}
            </p>
          )}
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
            {project.description}
          </p>
        )}

        {/* Meta */}
        <div className="mt-auto space-y-1.5">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Generated {fmt(project.createdAt)}
          </p>
          {project.lessonId && (
            <a
              href={`/lessons/${project.lessonId}`}
              className="inline-flex items-center gap-1 text-xs text-[#0cc0df] hover:underline"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              View source lesson
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 px-5 py-3"
        style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card-hover)" }}
      >
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold text-[#0d1c35] hover:opacity-90 active:scale-95 transition-all duration-150 ${isDeck ? "bg-[#0cc0df]" : "bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] text-white"}`}
        >
          {openLabel}
        </a>
        <button
          onClick={() => onDelete(project.id)}
          className="flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 active:scale-95 transition-all duration-150"
          style={{ border: "1px solid var(--border)" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
