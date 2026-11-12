"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { SearchResults } from "@/lib/search";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  regenerating: "Regenerating",
  done: "Generated",
  error: "Error",
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
      {label} <span className="font-normal">({count})</span>
    </h2>
  );
}

function Results() {
  const q = useSearchParams().get("q")?.trim() ?? "";
  // The answer for one query; while it belongs to an older query, the page shows "Searching…".
  const [answer, setAnswer] = useState<{ q: string; results: SearchResults | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error ?? "Search failed.");
        setAnswer({ q, results: data as SearchResults, error: null });
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setAnswer({ q, results: null, error: err instanceof Error ? err.message : "Search failed." });
      });
    return () => controller.abort();
  }, [q]);

  const current = answer?.q === q ? answer : null;
  const loading = !!q && !current;
  const results = current?.results ?? null;
  const error = current?.error ?? null;
  const total = (results?.courses.length ?? 0) + (results?.lessons.length ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Search</p>
        <h1 className="text-2xl font-bold break-words" style={{ color: "var(--text-primary)" }}>
          {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search"}
        </h1>
        {!q && (
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Type in the search box at the top to find lessons and courses.
          </p>
        )}
      </div>

      <div role="status" aria-live="polite">
        {loading && <p className="text-sm text-[var(--accent-text)]">Searching…</p>}
        {!loading && q && results && total === 0 && (
          <div className="text-center py-16 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No matches</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nothing in your lessons or courses matches &ldquo;{q}&rdquo;. Try fewer or different words.
            </p>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</p>}

      {!loading && results && results.courses.length > 0 && (
        <section>
          <SectionHeading label="Courses" count={results.courses.length} />
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.courses.map(c => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="block h-full rounded-3xl p-5 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <p className="font-bold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{c.title}</p>
                  {c.description && (
                    <p className="text-xs leading-relaxed line-clamp-2 mt-1" style={{ color: "var(--text-secondary)" }}>{c.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {c.subject && <Pill>{c.subject}</Pill>}
                    {c.term && <Pill>{c.term}</Pill>}
                    <Pill>{c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}</Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && results && results.lessons.length > 0 && (
        <section>
          <SectionHeading label="Lessons" count={results.lessons.length} />
          <ul className="space-y-2">
            {results.lessons.map(l => (
              <li key={l.id}>
                <Link
                  href={`/lessons/${l.id}`}
                  className="block rounded-2xl px-5 py-4 transition hover:bg-[var(--bg-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-semibold text-sm leading-snug min-w-0 break-words" style={{ color: "var(--text-primary)" }}>{l.title || "Untitled lesson"}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {l.courseTitle && <Pill>{l.courseTitle}</Pill>}
                      <Pill>{STATUS_LABEL[l.status] ?? l.status}</Pill>
                    </div>
                  </div>
                  {l.subtitle && (
                    <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{l.subtitle}</p>
                  )}
                  {l.snippet && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{l.snippet}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--accent-text)]">Loading…</p>}>
      <Results />
    </Suspense>
  );
}
