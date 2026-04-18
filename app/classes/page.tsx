"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Class } from "@/types/class";

function slugToLabel(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="text-xs font-semibold px-2 py-0.5 rounded-full transition hover:opacity-80"
      style={{ background: copied ? "rgba(45,212,160,0.12)" : "var(--bg-card-hover)", color: copied ? "#2dd4a0" : "var(--text-muted)", border: "1px solid var(--border)" }}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ClassCard({ cls, onDelete }: { cls: Class; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-3xl p-5 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="space-y-0.5">
        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{cls.name}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {cls.studentIds.length} student{cls.studentIds.length !== 1 ? "s" : ""} · {cls.language} · Created {new Date(cls.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Join code */}
      <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>Student Join Code</p>
          <p className="text-xl font-bold tracking-[0.2em]" style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{cls.joinCode}</p>
        </div>
        <CopyButton text={cls.joinCode} />
      </div>

      <div className="flex items-center justify-center gap-1 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <Link href={`/classes/${cls.id}/progress`} title="View student progress"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
          style={{ background: "rgba(45,212,160,0.08)", color: "#2dd4a0", border: "1px solid rgba(45,212,160,0.2)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Progress
        </Link>
        <Link href={`/classes/${cls.id}/concepts`} title="Manage concepts"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
          style={{ background: "rgba(12,192,223,0.08)", color: "#0cc0df", border: "1px solid rgba(12,192,223,0.2)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Concepts
        </Link>
        <Link href={`/classes/${cls.id}`} title="Edit class settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
          style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </Link>
        <button onClick={() => onDelete(cls.id)} title="Delete class"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
          style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ClassesPage() {
  useSession({ required: true });
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/classes").then(r => r.json()).then(data => {
      setClasses(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this class? Students will lose access.")) return;
    await fetch(`/api/classes/${id}`, { method: "DELETE" });
    setClasses(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Classes</h1>
          {!loading && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Each class gets a join code students use to access NeXTBox.
            </p>
          )}
        </div>
        <Link href="/classes/new"
          className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          style={{ background: "#0cc0df", color: "#0a0b13" }}>
          + New Class
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No classes yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Create a class to get a join code for your students.
          </p>
          <Link href="/classes/new"
            className="rounded-full px-5 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{ background: "#0cc0df", color: "#0a0b13" }}>
            Create First Class
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map(cls => <ClassCard key={cls.id} cls={cls} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  );
}
