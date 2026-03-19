"use client";

import type { SavedProject } from "@/types/project";

interface Props {
  project: SavedProject;
  onDelete: (id: string) => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectCard({ project, onDelete }: Props) {
  const isDeck = project.type === "deck";
  const accentColor = isDeck ? "bg-[#0cc0df]" : "bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e]";
  const typeLabel = isDeck ? "Slide Deck" : project.isQuiz ? "Quiz" : "Form";
  const openLabel = isDeck ? "Open in Slides" : "Open in Forms";

  return (
    <div className="h-full rounded-2xl flex flex-col overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className={`h-1 w-full ${accentColor}`} />

      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-base leading-snug" style={{ color: "var(--text-primary)" }}>{project.title}</h2>
          <span className="shrink-0 rounded-xl px-2.5 py-0.5 text-xs font-medium text-[#0cc0df]" style={{ background: "var(--accent-bg)" }}>
            {typeLabel}
          </span>
        </div>

        {project.subtitle && (
          <p className="self-start rounded-xl px-3 py-0.5 text-xs text-[#0cc0df] leading-relaxed" style={{ background: "var(--accent-bg)" }}>
            {project.subtitle}
          </p>
        )}

        {project.description && (
          <p className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>{project.description}</p>
        )}

        <div className="mt-auto text-xs" style={{ color: "var(--text-muted)" }}>
          Created {fmt(project.createdAt)}
        </div>
      </div>

      <div className="flex gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card-hover)" }}>
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center rounded-xl bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 active:scale-95 transition-all duration-150"
        >
          {openLabel}
        </a>
        <button
          onClick={() => onDelete(project.id)}
          className="flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 active:scale-95 transition-all duration-150"
          style={{ border: "1px solid var(--border)" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
