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
  const accentColor = isDeck ? "bg-violet-700" : "bg-blue-700";
  const typeLabel = isDeck ? "Slide Deck" : project.isQuiz ? "Quiz" : "Form";
  const typeIcon = isDeck ? "🖼️" : "📋";
  const openLabel = isDeck ? "Open in Slides" : "Open in Forms";

  return (
    <div className="h-full rounded-2xl bg-gray-700 dark:bg-gray-200 flex flex-col overflow-hidden border border-gray-600 dark:border-gray-300 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200">
      <div className={`h-1 w-full ${accentColor}`} />

      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-white dark:text-gray-900 text-base leading-snug">{project.title}</h2>
          <span className="shrink-0 rounded-md bg-gray-600 dark:bg-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-200 dark:text-gray-600">
            {typeIcon} {typeLabel}
          </span>
        </div>

        {project.subtitle && (
          <p className="self-start rounded-md bg-gray-600 dark:bg-gray-300 px-3 py-0.5 text-xs text-gray-300 dark:text-gray-500 leading-relaxed">
            {project.subtitle}
          </p>
        )}

        {project.description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2">{project.description}</p>
        )}

        <div className="mt-auto text-xs text-gray-400 dark:text-gray-600">
          Created {fmt(project.createdAt)}
        </div>
      </div>

      <div className="flex gap-2 px-5 py-3 bg-gray-800 dark:bg-gray-300 border-t border-gray-600 dark:border-gray-300">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center rounded-lg bg-indigo-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-900 active:scale-95 transition-all duration-150"
        >
          {openLabel}
        </a>
        <button
          onClick={() => onDelete(project.id)}
          className="flex items-center justify-center rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-900 active:scale-95 transition-all duration-150"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
