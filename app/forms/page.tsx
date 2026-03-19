"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AssetCard from "@/components/AssetCard";
import type { SavedProject } from "@/types/project";

function FormsInner() {
  useSession({ required: true });
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId");

  const [forms, setForms] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: SavedProject[]) => {
        setForms(Array.isArray(data) ? data.filter((p) => p.type === "form") : []);
        setLoading(false);
      });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this form record? This will not delete the file from Google Drive.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setForms((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = lessonId ? forms.filter((f) => f.lessonId === lessonId) : forms;
  const quizzes    = filtered.filter((f) => f.isQuiz);
  const standalones = filtered.filter((f) => !f.isQuiz);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Assets</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Forms</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {lessonId ? "Filtered by lesson." : "All generated Google Forms — quizzes and standalone."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lessonId && (
            <Link href="/forms" className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Show all
            </Link>
          )}
          {!loading && (
            <span className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {filtered.length} {filtered.length === 1 ? "form" : "forms"}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-3xl" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div className="w-12 h-12 rounded-full bg-[#ff8c4a]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff8c4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <p className="text-sm mb-2 font-semibold" style={{ color: "var(--text-primary)" }}>
            {lessonId ? "No form for this lesson yet" : "No forms yet"}
          </p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Generate a bundle from a lesson to create a quiz form.
          </p>
          <Link href="/" className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
            Go to Lessons
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {quizzes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Quizzes ({quizzes.length})
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quizzes.map((form) => (
                  <AssetCard key={form.id} project={form} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
          {standalones.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Standalone Forms ({standalones.length})
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {standalones.map((form) => (
                  <AssetCard key={form.id} project={form} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FormsPage() {
  return (
    <Suspense>
      <FormsInner />
    </Suspense>
  );
}
