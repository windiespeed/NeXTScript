"use client";

import { useEffect, useState } from "react";
import type { DeckContent } from "@/lib/deck/schema";
import type { Course } from "@/types/course";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const buttonClass = "rounded-full px-4 py-2 text-xs font-bold transition hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";

type Target = "pptx" | "google-slides";
type Status = { kind: "idle" } | { kind: "busy"; target: Target } | { kind: "done"; message: string; url?: string } | { kind: "error"; message: string };

const METHOD_NOTE: Record<string, string> = {
  template: "Drawn onto a copy of the course's Slides template.",
  converted: "Converted from .pptx by Google Drive. Set a Slides template in Course Settings to use your own branding.",
};

/**
 * Export buttons for a deck in the new format: download a .pptx, or create a Google Slides deck
 * in Drive. Picking a course files the deck in that course's folder and uses its Slides template.
 */
export default function DeckExportPanel({ deck, themeId, disabled }: { deck: DeckContent; themeId: string; disabled?: boolean }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    fetch("/api/courses")
      .then(r => (r.ok ? r.json() : []))
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, []);

  const course = courses.find(c => c.id === courseId);
  const hasTemplate = !!course?.settings?.defaultTemplateUrl;

  async function run(target: Target) {
    setStatus({ kind: "busy", target });
    try {
      const res = await fetch("/api/deck/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck, target, themeId, ...(courseId ? { courseId } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Export failed (${res.status}).`);
      }
      if (target === "pptx") {
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${deck.lessonTitle.replace(/[^\w\- ]+/g, "").trim() || "deck"}.pptx`;
        a.click();
        URL.revokeObjectURL(href);
        setStatus({ kind: "done", message: "Downloaded the .pptx." });
      } else {
        const data = (await res.json()) as { url: string; method: string };
        setStatus({ kind: "done", message: `Created the Google Slides deck. ${METHOD_NOTE[data.method] ?? ""}`, url: data.url });
      }
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Export failed." });
    }
  }

  const busy = status.kind === "busy";

  return (
    <section aria-labelledby="deck-export-heading" className="space-y-3 rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h2 id="deck-export-heading" className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Export
      </h2>
      <div>
        <label htmlFor="deck-export-course" className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Course <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
        </label>
        <select id="deck-export-course" className={inputClass} style={inputStyle} value={courseId} onChange={e => setCourseId(e.target.value)} aria-describedby="deck-export-course-hint">
          <option value="">No course</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <p id="deck-export-course-hint" className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {course
            ? hasTemplate
              ? "Google Slides export uses this course's Slides template and files the deck in its folder."
              : "This course has no Slides template, so Google Slides export converts the .pptx. It's filed in the course folder."
            : "Pick a course to use its Slides template and file the deck in its Drive folder."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          style={{ background: "var(--accent-bg)", color: "var(--accent-text)", border: "1px solid var(--border-accent)" }}
          disabled={disabled || busy}
          onClick={() => run("pptx")}
        >
          {status.kind === "busy" && status.target === "pptx" ? "Building…" : "Download .pptx"}
        </button>
        <button
          type="button"
          className={`${buttonClass} bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] text-[#0a0b13]`}
          disabled={disabled || busy}
          onClick={() => run("google-slides")}
        >
          {status.kind === "busy" && status.target === "google-slides" ? "Creating…" : "Save as Google Slides"}
        </button>
      </div>
      <div role="status" className="text-xs">
        {status.kind === "done" && (
          <p style={{ color: "var(--success-text)" }}>
            {status.message}{" "}
            {status.url && (
              <a href={status.url} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "var(--accent-text)" }}>
                Open in Google Slides
              </a>
            )}
          </p>
        )}
        {status.kind === "error" && <p style={{ color: "var(--danger-text)" }}>{status.message}</p>}
      </div>
    </section>
  );
}
