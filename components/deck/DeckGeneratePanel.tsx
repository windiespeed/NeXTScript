"use client";

import { useEffect, useState } from "react";
import type { DeckContent } from "@/lib/deck/schema";
import AiModelNote from "@/components/AiModelNote";
import type { SavedKeys } from "@/lib/aiModels";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

/** Notes in, deck out: calls /api/deck/generate with the user's own Anthropic key. */
export default function DeckGeneratePanel({ onDeck }: { onDeck: (deck: DeckContent) => void }) {
  const [notes, setNotes] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  // Which model runs is decided on the server from the saved key and Profile preference; this
  // only loads enough to say which one.
  const [keys, setKeys] = useState<SavedKeys | null>(null);
  const [preference, setPreference] = useState<string>("auto");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/user/settings")
      .then(r => (r.ok ? r.json() : null))
      .then(s => {
        if (!s) return;
        setKeys({ anthropic: !!s.hasKey, gemini: !!s.hasGeminiKey });
        setPreference(s.preferredAiModel ?? "auto");
      })
      .catch(() => {});
  }, []);

  async function generate() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/deck/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, ...(lessonTitle.trim() ? { lessonTitle: lessonTitle.trim() } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Generation failed (${res.status}).`);
      onDeck(data.deck as DeckContent);
      const n = (data.deck as DeckContent).slides.length;
      setStatus({ ok: true, text: `Generated ${n} slides.${data.attempts > 1 ? " One round of fixes was needed to fit the slide limits." : ""}` });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Generation failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="deck-generate-heading" className="space-y-3 rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h2 id="deck-generate-heading" className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Generate from notes
      </h2>
      <div>
        <label htmlFor="deck-generate-title" className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Lesson title <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
        </label>
        <input id="deck-generate-title" className={inputClass} style={inputStyle} value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="deck-generate-notes" className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Notes
        </label>
        <textarea
          id="deck-generate-notes"
          className={inputClass}
          style={inputStyle}
          rows={8}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Rough notes, an outline, or a brain-dump for one lesson."
        />
      </div>
      <AiModelNote preference={preference} keys={keys} providers={["anthropic"]} />
      <button
        type="button"
        className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-xs font-bold text-[#0a0b13] transition hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        disabled={busy || !notes.trim()}
        onClick={generate}
      >
        {busy ? "Generating… (this can take a minute or two)" : "Generate deck"}
      </button>
      <div role="status" className="text-xs">
        {status && <p style={{ color: status.ok ? "var(--success-text)" : "var(--danger-text)" }}>{status.text}</p>}
      </div>
    </section>
  );
}
