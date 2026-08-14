"use client";

import { useEffect, useState } from "react";
import type { Lesson } from "@/types/lesson";

// Overview Doc isn't a bundle option — generate it from the lesson page instead, where you
// can pick which decks/quizzes it summarizes.
type FileChoice = "slides" | "quiz";
type Destination = "drive" | "download";
type ModalStatus = "idle" | "loading";

interface Props {
  lesson: Lesson | null;
  hasQuizDraft: boolean;
  onClose: () => void;
  onGenerate: (id: string, files: FileChoice[], destination: Destination) => Promise<void>;
}

export default function GenerateModal({ lesson, hasQuizDraft, onClose, onGenerate }: Props) {
  // Quiz defaults off — the server only ever pushes an existing quiz draft to a Google Form,
  // it never writes quiz content itself, so checking it does nothing unless a draft exists.
  const [selectedFiles, setSelectedFiles] = useState<FileChoice[]>(["slides"]);
  const [destination, setDestination] = useState<Destination>("drive");
  const [modalStatus] = useState<ModalStatus>("idle");

  // Reset file/destination state whenever a new lesson opens the modal
  useEffect(() => {
    if (lesson) {
      setSelectedFiles(["slides"]);
      setDestination("drive");
    }
  }, [lesson?.id]);

  if (!lesson) return null;

  const quizDisabled = destination === "download" || !hasQuizDraft;
  const effectiveFiles = (destination === "download" || !hasQuizDraft)
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
    onGenerate(lesson!.id, effectiveFiles, destination);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && modalStatus !== "loading") onClose();
  }

  const labelClass = "flex items-center gap-2.5 text-sm cursor-pointer select-none";
  const sectionLabel = "text-xs font-semibold text-[#0cc0df] uppercase tracking-wide mb-2";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-sm rounded-3xl shadow-2xl p-6 flex flex-col gap-5 mx-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Generate Bundle</h2>
            <p className="text-xs text-[#0cc0df] mt-0.5 truncate max-w-[220px]">{lesson.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={modalStatus === "loading"}
            className="text-lg leading-none disabled:opacity-40 active:scale-95 transition-all duration-150"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Output Files */}
        <div>
          <p className={sectionLabel}>Output Files</p>
          <div className="flex flex-col gap-2.5">
            <label className={labelClass} style={{ color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={selectedFiles.includes("slides")}
                onChange={() => toggleFile("slides")}
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Slides <span className="text-xs" style={{ color: "var(--text-muted)" }}>(Google Slides)</span>
            </label>
            <label
              className={`flex items-center gap-2.5 text-sm cursor-pointer select-none ${quizDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
              style={{ color: "var(--text-primary)" }}
            >
              <input
                type="checkbox"
                checked={selectedFiles.includes("quiz")}
                onChange={() => !quizDisabled && toggleFile("quiz")}
                disabled={quizDisabled}
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Quiz <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {destination === "download" ? "(not available as PDF)" : !hasQuizDraft ? "(no draft yet — create one on the Quizzes page)" : "(Google Forms)"}
              </span>
            </label>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Overview Doc moved to its own button on the lesson page, so you can pick which decks/quizzes it summarizes.
          </p>
        </div>

        {/* Destination */}
        <div>
          <p className={sectionLabel}>Destination</p>
          <div className="flex flex-col gap-2.5">
            <label className={labelClass} style={{ color: "var(--text-primary)" }}>
              <input
                type="radio"
                name="destination"
                value="drive"
                checked={destination === "drive"}
                onChange={() => handleDestinationChange("drive")}
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Push to Google Drive
            </label>
            <label className={labelClass} style={{ color: "var(--text-primary)" }}>
              <input
                type="radio"
                name="destination"
                value="download"
                checked={destination === "download"}
                onChange={() => handleDestinationChange("download")}
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Download as PDF
            </label>
          </div>
        </div>

        <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>
          Uses this course&apos;s Slides Template, if one is set in Course Settings.
        </p>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            disabled={modalStatus === "loading"}
            className="rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-40 active:scale-95 transition-all duration-150 hover:bg-[var(--bg-card-hover)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="rounded-full px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] text-white hover:opacity-90 disabled:opacity-40 active:scale-95 transition-all duration-150"
          >
            Generate
          </button>
        </div>

      </div>
    </div>
  );
}
