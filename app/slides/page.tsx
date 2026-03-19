"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AssetCard from "@/components/AssetCard";
import type { SavedProject } from "@/types/project";

function SlidesInner() {
  useSession({ required: true });
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId");

  const [decks, setDecks] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: SavedProject[]) => {
        setDecks(Array.isArray(data) ? data.filter((p) => p.type === "deck") : []);
        setLoading(false);
      });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this slide deck record? This will not delete the file from Google Drive.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setDecks((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = lessonId ? decks.filter((d) => d.lessonId === lessonId) : decks;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Assets</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Slide Decks</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {lessonId ? "Filtered by lesson." : "All generated Google Slides presentations."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lessonId && (
            <Link href="/slides" className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Show all
            </Link>
          )}
          {!loading && (
            <span className="rounded-xl px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {filtered.length} {filtered.length === 1 ? "deck" : "decks"}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div className="w-12 h-12 rounded-xl bg-[#0cc0df]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <p className="text-sm mb-2 font-semibold" style={{ color: "var(--text-primary)" }}>
            {lessonId ? "No slide deck for this lesson yet" : "No slide decks yet"}
          </p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Generate a bundle from any lesson to create a Google Slides deck.
          </p>
          <Link href="/" className="rounded-xl bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
            Go to Lessons
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deck) => (
            <AssetCard key={deck.id} project={deck} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SlidesPage() {
  return (
    <Suspense>
      <SlidesInner />
    </Suspense>
  );
}
