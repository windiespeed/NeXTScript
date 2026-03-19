"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

const PLANNED = [
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    title: "Reference Links",
    description: "Save URLs that are useful across lessons — documentation, tutorials, style guides.",
    color: "#0cc0df",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff8c4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    title: "File Attachments",
    description: "Upload PDFs, rubrics, and handouts to reference when building lessons.",
    color: "#ff8c4a",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    title: "Shared Folders",
    description: "Link Google Drive folders so assets are always one click away.",
    color: "#2dd4a0",
  },
];

export default function ResourcesPage() {
  useSession({ required: true });

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Library</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Resources</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Shared links, files, and references for your curriculum.</p>
      </div>

      <div className="rounded-2xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="w-14 h-14 rounded-2xl bg-[#0cc0df]/10 flex items-center justify-center mx-auto mb-5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Coming Soon</h2>
        <p className="text-sm max-w-sm mx-auto mb-8" style={{ color: "var(--text-muted)" }}>
          The Resources library is planned for a future phase. Save links, files, and Drive folders referenced across any lesson or course.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
          {PLANNED.map((item) => (
            <div key={item.title} className="rounded-2xl p-4 space-y-2" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-card)" }}>
                {item.icon}
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/" className="text-sm text-[#0cc0df] hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
