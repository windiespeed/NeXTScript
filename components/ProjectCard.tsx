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
    <div className="h-full rounded-2xl bg-[#0d1c35] dark:bg-gradient-to-br dark:from-[#0d1c35] dark:to-[#0cc0df] flex flex-col overflow-hidden border border-[#1e4a85] shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
      <div className={`h-1 w-full ${accentColor}`} />

      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-white text-base leading-snug">{project.title}</h2>
          <span className="shrink-0 rounded-md bg-[#0d1c35] px-2.5 py-0.5 text-xs font-medium text-[#0cc0df]">
            {typeLabel}
          </span>
        </div>

        {project.subtitle && (
          <p className="self-start rounded-md bg-[#0d1c35] px-3 py-0.5 text-xs text-[#0cc0df] leading-relaxed">
            {project.subtitle}
          </p>
        )}

        {project.description && (
          <p className="text-xs text-gray-300 line-clamp-2">{project.description}</p>
        )}

        <div className="mt-auto text-xs text-gray-400">
          Created {fmt(project.createdAt)}
        </div>
      </div>

      <div className="flex gap-2 px-5 py-3 border-t border-white/10">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center rounded-lg bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0d1c35] hover:opacity-90 active:scale-95 transition-all duration-150"
        >
          {openLabel}
        </a>
        <button
          onClick={() => onDelete(project.id)}
          className="flex items-center justify-center rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 active:scale-95 transition-all duration-150"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
