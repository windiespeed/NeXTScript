"use client";

import { useEffect, useState } from "react";
import type { Lesson } from "@/types/lesson";

type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";
type ModalStatus = "idle" | "loading";

interface Props {
  lesson: Lesson | null;
  onClose: () => void;
  onGenerate: (id: string, files: FileChoice[], destination: Destination, templateId?: string) => Promise<void>;
}

function extractPresentationId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function GenerateModal({ lesson, onClose, onGenerate }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<FileChoice[]>(["slides", "doc", "quiz"]);
  const [destination, setDestination] = useState<Destination>("drive");
  const [modalStatus] = useState<ModalStatus>("idle");
  const [templateUrl, setTemplateUrl] = useState("");

  // Load saved template URL once on mount
  useEffect(() => {
    fetch("/api/user/settings")
      .then(r => r.json())
      .then(data => { if (data.defaultTemplateUrl) setTemplateUrl(data.defaultTemplateUrl); })
      .catch(() => {});
  }, []);

  // Reset file/destination state whenever a new lesson opens the modal
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
    const trimmed = templateUrl.trim();
    const templateId = trimmed ? extractPresentationId(trimmed) ?? undefined : undefined;
    // Persist the template URL for next time
    fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultTemplateUrl: trimmed }),
    }).catch(() => {});
    onClose();
    onGenerate(lesson!.id, effectiveFiles, destination, templateId);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && modalStatus !== "loading") onClose();
  }

  const labelClass = "flex items-center gap-2.5 text-sm text-white cursor-pointer select-none";
  const sectionLabel = "text-xs font-semibold text-[#0cc0df] uppercase tracking-wide mb-2";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#112543] border border-[#1e4a85]/60 shadow-2xl p-6 flex flex-col gap-5 mx-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white text-base">Generate Bundle</h2>
            <p className="text-xs text-[#0cc0df] mt-0.5 truncate max-w-[220px]">{lesson.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={modalStatus === "loading"}
            className="text-gray-400 hover:text-white text-lg leading-none disabled:opacity-40 active:scale-95 transition-all duration-150"
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
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Slides <span className="text-gray-400 text-xs">(Google Slides)</span>
            </label>
            <label className={labelClass}>
              <input
                type="checkbox"
                checked={selectedFiles.includes("doc")}
                onChange={() => toggleFile("doc")}
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Assessment Doc <span className="text-gray-400 text-xs">(Google Doc)</span>
            </label>
            <label className={`flex items-center gap-2.5 text-sm cursor-pointer select-none ${quizDisabled ? "opacity-40 cursor-not-allowed" : "text-white"}`}>
              <input
                type="checkbox"
                checked={selectedFiles.includes("quiz")}
                onChange={() => !quizDisabled && toggleFile("quiz")}
                disabled={quizDisabled}
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Quiz <span className="text-xs text-gray-400">{quizDisabled ? "(not available as PDF)" : "(Google Forms)"}</span>
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
                className="w-4 h-4 accent-[#0cc0df]"
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
                className="w-4 h-4 accent-[#0cc0df]"
              />
              Download as PDF
            </label>
          </div>
        </div>

        {/* Template URL */}
        <div>
          <p className={sectionLabel}>Slides Template <span className="normal-case font-normal text-gray-400">(optional)</span></p>
          <div className="flex gap-2">
            <input
              type="url"
              value={templateUrl}
              onChange={(e) => setTemplateUrl(e.target.value)}
              placeholder="https://docs.google.com/presentation/d/…"
              className="flex-1 rounded-lg bg-[#0d1c35] border border-[#1e4a85] text-white placeholder:text-gray-500 text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0cc0df]"
            />
            {templateUrl.trim() && (
              <button
                onClick={() => { setTemplateUrl(""); fetch("/api/user/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultTemplateUrl: "" }) }).catch(() => {}); }}
                className="rounded-lg bg-[#0d1c35] border border-[#1e4a85] px-2.5 text-gray-400 hover:text-white transition text-xs"
                title="Clear saved template"
              >
                ✕
              </button>
            )}
          </div>
          {templateUrl.trim() && !extractPresentationId(templateUrl.trim()) && (
            <p className="text-xs text-red-400 mt-1">Could not extract a presentation ID from that URL.</p>
          )}
          {!templateUrl.trim() && (
            <p className="text-xs text-gray-400 mt-1">Leave blank to create a fresh presentation.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            disabled={modalStatus === "loading"}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold bg-[#1e4a85] text-white hover:bg-[#2a5a9a] disabled:opacity-40 active:scale-95 transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] text-white hover:opacity-90 disabled:opacity-40 active:scale-95 transition-all duration-150"
          >
            Generate
          </button>
        </div>

      </div>
    </div>
  );
}
