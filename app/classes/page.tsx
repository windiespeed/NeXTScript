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
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{cls.name}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {cls.studentIds.length} student{cls.studentIds.length !== 1 ? "s" : ""} · {cls.language}
          </p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(12,192,223,0.12)", color: "#0cc0df" }}>
          {cls.assignedConcepts.length} concept{cls.assignedConcepts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Join code */}
      <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>Student Join Code</p>
          <p className="text-xl font-bold tracking-[0.2em]" style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{cls.joinCode}</p>
        </div>
        <CopyButton text={cls.joinCode} />
      </div>

      {/* Concepts */}
      {cls.assignedConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cls.assignedConcepts.map(c => (
            <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(99,102,241,0.10)", color: "var(--accent-purple)", border: "1px solid rgba(99,102,241,0.2)" }}>
              {slugToLabel(c)}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Created {new Date(cls.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <div className="flex gap-2">
          <Link href={`/classes/${cls.id}/progress`}
            className="text-xs font-semibold px-3 py-1 rounded-full transition hover:opacity-80"
            style={{ background: "rgba(45,212,160,0.08)", color: "#2dd4a0", border: "1px solid rgba(45,212,160,0.2)" }}>
            Progress
          </Link>
          <Link href={`/classes/${cls.id}/concepts`}
            className="text-xs font-semibold px-3 py-1 rounded-full transition hover:opacity-80"
            style={{ background: "rgba(12,192,223,0.08)", color: "#0cc0df", border: "1px solid rgba(12,192,223,0.2)" }}>
            Concepts
          </Link>
          <Link href={`/classes/${cls.id}`}
            className="text-xs font-semibold px-3 py-1 rounded-full transition hover:opacity-80"
            style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            Edit
          </Link>
          <button onClick={() => onDelete(cls.id)}
            className="text-xs font-semibold px-3 py-1 rounded-full transition hover:opacity-80"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            Delete
          </button>
        </div>
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
