import Link from "next/link";

/**
 * Shown on every classic Slides page while the classic generator is being phased out.
 * Classic keeps working exactly as before (course Google Slides template, Generate to Drive,
 * Classroom push); this only points instructors at Notes to Slides as the default.
 */
export default function ClassicSlidesBanner({ lessonId }: { lessonId?: string }) {
  const href = lessonId ? `/ingest?lessonId=${lessonId}` : "/ingest";
  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: "var(--accent-bg)", border: "1px solid var(--border)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          You&apos;re in Classic Slides. Notes to Slides is now the default way to build decks.
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Nothing here has changed: your lesson content, course Google Slides template, Generate to Drive
          and Google Classroom push all still work.{" "}
          {lessonId
            ? "To try the new flow, open this lesson in Notes to Slides and use “Start from this lesson’s content”."
            : "To try the new flow, open a lesson in Notes to Slides and use “Start from this lesson’s content”."}
        </p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-center rounded-full bg-[#0cc0df] px-4 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition"
      >
        Open in Notes to Slides →
      </Link>
    </div>
  );
}
