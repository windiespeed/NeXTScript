"use client";

import { useEffect, useState } from "react";
import type { Lesson } from "@/types/lesson";

type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";
type ModalStatus = "idle";

interface Props {
  lesson: Lesson | null;
  onClose: () => void;
  onGenerate: (id: string, files: FileChoice[], destination: Destination) => Promise<void>;
}

export default function GenerateModal({ lesson, onClose, onGenerate }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<FileChoice[]>(["slides", "doc", "quiz"]);
  const [destination, setDestination] = useState<Destination>("drive");
  const [modalStatus] = useState<ModalStatus>("idle");

  // Reset state whenever a new lesson opens the modal
  useEffect(() => {
    if (lesson) {
      setSelectedFiles(["slides", "doc", "quiz"]);
      setDestination("drive");
    }
  }, [lesson?.id]);

  if (!lesson) return null;

  const quizDisabled = destination === "download";
  const effectiveFiles = destination === "download"
    ? selectedFiles.filter(f => f !== "quiz")
    : selectedFiles;
  const canGenerate = effectiveFiles.length > 0;

  function toggleFile(file: FileChoice) {
    setSelectedFiles(prev =>
      prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]
    );
  }

  function handleDestinationChange(dest: Destination) {
    setDestination(dest);
    if (dest === "download") {
      setSelectedFiles(prev => prev.filter(f => f !== "quiz"));
    }
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    onClose();
    onGenerate(lesson.id, effectiveFiles, destination);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && modalStatus !== "loading") onClose();
  }

  const labelClass = "flex items-center gap-2.5 text-sm text-white dark:text-gray-900 cursor-pointer select-none";
  const sectionLabel = "text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-sm rounded-2xl bg-gray-700 dark:bg-gray-200 border border-gray-600 dark:border-gray-300 shadow-xl p-6 flex flex-col gap-5 mx-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white dark:text-gray-900 text-base">Generate Bundle</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[220px]">{lesson.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={modalStatus === "loading"}
            className="text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-900 text-lg leading-none disabled:opacity-40 active:scale-95 transition-all duration-150"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Output Files */}
        <div>
          <p className={sectionLabel}>Output Files</p>
          <div className="flex flex-col gap-2.5">
            <label className={labelClass}>
              <input
                type="checkbox"
                checked={selectedFiles.includes("slides")}
                onChange={() => toggleFile("slides")}
                className="w-4 h-4 accent-emerald-700"
              />
              Slides <span className="text-gray-400 dark:text-gray-500 text-xs">(Google Slides)</span>
            </label>
            <label className={labelClass}>
              <input
                type="checkbox"
                checked={selectedFiles.includes("doc")}
                onChange={() => toggleFile("doc")}
                className="w-4 h-4 accent-emerald-700"
              />
              Assessment Doc <span className="text-gray-400 dark:text-gray-500 text-xs">(Google Doc)</span>
            </label>
            <label className={`flex items-center gap-2.5 text-sm cursor-pointer select-none ${quizDisabled ? "opacity-40 cursor-not-allowed" : "text-white dark:text-gray-900"}`}>
              <input
                type="checkbox"
                checked={selectedFiles.includes("quiz")}
                onChange={() => !quizDisabled && toggleFile("quiz")}
                disabled={quizDisabled}
                className="w-4 h-4 accent-emerald-700"
              />
              Quiz <span className="text-xs text-gray-400 dark:text-gray-500">{quizDisabled ? "(not available as PDF)" : "(Google Forms)"}</span>
            </label>
          </div>
        </div>

        {/* Destination */}
        <div>
          <p className={sectionLabel}>Destination</p>
          <div className="flex flex-col gap-2.5">
            <label className={labelClass}>
              <input
                type="radio"
                name="destination"
                value="drive"
                checked={destination === "drive"}
                onChange={() => handleDestinationChange("drive")}
                className="w-4 h-4 accent-emerald-700"
              />
              Push to Google Drive
            </label>
            <label className={labelClass}>
              <input
                type="radio"
                name="destination"
                value="download"
                checked={destination === "download"}
                onChange={() => handleDestinationChange("download")}
                className="w-4 h-4 accent-emerald-700"
              />
              Download as PDF
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            disabled={modalStatus === "loading"}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold bg-gray-600 dark:bg-gray-300 text-white dark:text-gray-900 hover:bg-gray-500 dark:hover:bg-gray-400 disabled:opacity-40 active:scale-95 transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold bg-emerald-800 text-white hover:bg-emerald-900 disabled:opacity-40 active:scale-95 transition-all duration-150"
          >
            Generate
          </button>
        </div>

      </div>
    </div>
  );
}
