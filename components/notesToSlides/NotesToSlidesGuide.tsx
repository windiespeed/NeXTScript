"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

const STORAGE_KEY = "notes-to-slides-guide-open";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Pick the course (and lesson)",
    body: "The course decides the deck's locked headings and its Google Slides template. Attach an existing lesson to add the deck to it, or leave “Create new lesson” to make one.",
  },
  {
    title: "Check the slide headings",
    body: "Each course section marked “Slide heading” becomes a slide heading, in order. Change them in Course Settings.",
  },
  {
    title: "Paste your notes",
    body: "Outlines, bullets or a brain-dump. You don't need to match the section names; the AI sorts each point under the right heading. Lessons made in the old Classic Slides can use “Start from this lesson's content” to fill this in for you.",
  },
  {
    title: "Generate, then review",
    body: "Use the arrow keys to page through the preview and Edit Slides to fix any slide. Save Draft keeps the deck on its lesson without exporting and clears the form. A lesson can have several decks: pick the lesson again (or use Edit on the lesson page) to open one, or Start a New Deck.",
  },
  {
    title: "Export to Drive",
    body: "Export builds the deck on the course template, saves it into the lesson's Drive folder, lists it under the lesson's Slides, and clears the form for your next deck.",
  },
  {
    title: "Push to Google Classroom",
    body: "Publish the lesson from the course or lesson page. Every exported deck of the lesson is attached.",
  },
];

/** Collapsible how-to for Notes to Slides, including where Classic Slides users' work went.
 * Open by default on a first visit; Show/Hide is remembered per browser. */
// The remembered choice, read straight from localStorage. Same-tab changes are announced with
// CHANGED, other tabs through the "storage" event.
const CHANGED = "notes-to-slides-guide-changed";
function readOpen(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== "0"; } catch { return true; }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export default function NotesToSlidesGuide() {
  // Saved only when the instructor clicks Show/Hide. (The old version saved from <details>'
  // "toggle" event, which the browser also fires when the element first appears open, so a
  // remembered "Hide" could be overwritten.)
  const open = useSyncExternalStore(subscribe, readOpen, () => true);

  function handleSummaryClick(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    try { localStorage.setItem(STORAGE_KEY, open ? "0" : "1"); } catch {}
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <details
      open={open}
      className="group rounded-3xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <summary onClick={handleSummaryClick} className="flex items-center justify-between gap-3 px-6 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-text)]">How Notes to Slides works</span>
        <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="px-6 pb-6 space-y-5">
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl p-4 space-y-1"
              style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                <span className="tabular-nums mr-1.5" style={{ color: "var(--accent-text)" }}>{i + 1}</span>
                {step.title}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--accent-purple-bg)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--accent-purple)" }}>Used Classic Slides before?</p>
          <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: "var(--text-secondary)" }}>
            <li>Classic Slides has been retired. Your existing decks, lessons and Drive files are untouched, and old decks still open and push to Classroom.</li>
            <li>To rebuild a lesson&apos;s deck, open it here (or use “+ New Deck” on the lesson page), then click “Start from this lesson&apos;s content”. Its old Slide Content and section text are loaded as notes, ready to generate.</li>
            <li>Lesson sections (overview, activities, rubric) are still edited with Edit Content on the lesson page, and still feed the Overview Doc and quizzes.</li>
          </ul>
          <Link href="/courses" className="inline-block text-[10px] font-semibold hover:underline" style={{ color: "var(--accent-purple)" }}>
            Go to your courses →
          </Link>
        </div>
      </div>
    </details>
  );
}
