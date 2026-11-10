"use client";

import { useState } from "react";
import Link from "next/link";
import { THEMES, getTheme } from "@/lib/themes";
import { DeckSchema } from "@/lib/deck/schema";
import type { DeckContent } from "@/lib/deck/schema";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import DeckPreview from "@/components/deck/DeckPreview";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

type Parsed = { deck: DeckContent; errors: null } | { deck: null; errors: string[] };

function parseDeck(source: string): Parsed {
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch (e) {
    return { deck: null, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const result = DeckSchema.safeParse(json);
  if (result.success) return { deck: result.data, errors: null };
  return {
    deck: null,
    errors: result.error.issues.slice(0, 20).map(i => `${i.path.join(".") || "(deck)"}: ${i.message}`),
  };
}

/**
 * Preview for the new deck format: pick a theme, paste deck JSON, and see every slide drawn
 * through the layout registry with its overflow warnings and speaker notes.
 */
export default function DeckPreviewPage() {
  const [themeId, setThemeId] = useState(THEMES[0].id);
  const [source, setSource] = useState(() => JSON.stringify(SAMPLE_DECK, null, 2));
  // The last valid deck stays on screen while the JSON is mid-edit.
  const [deck, setDeck] = useState<DeckContent>(SAMPLE_DECK);
  const [errors, setErrors] = useState<string[] | null>(null);

  function update(next: string) {
    setSource(next);
    const parsed = parseDeck(next);
    if (parsed.deck) {
      setDeck(parsed.deck);
      setErrors(null);
    } else {
      setErrors(parsed.errors);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/ingest" className="text-xs font-semibold" style={{ color: "var(--accent-text)" }}>
          ← Notes to Slides
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Deck preview
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Checks a deck in the new format before export. Slides with text that had to shrink, or that doesn&apos;t fit, get a badge.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div>
            <label htmlFor="deck-preview-theme" className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Theme
            </label>
            <select id="deck-preview-theme" className={inputClass} style={inputStyle} value={themeId} onChange={e => setThemeId(e.target.value)}>
              {THEMES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="deck-preview-json" className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Deck JSON
            </label>
            <textarea
              id="deck-preview-json"
              className={`${inputClass} font-mono`}
              style={inputStyle}
              rows={24}
              spellCheck={false}
              value={source}
              onChange={e => update(e.target.value)}
              aria-describedby="deck-preview-json-status"
              aria-invalid={errors ? true : undefined}
            />
            <div id="deck-preview-json-status" role="status" className="mt-1 text-xs">
              {errors ? (
                <ul className="space-y-0.5" style={{ color: "var(--danger-text)" }}>
                  {errors.map(e => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : (
                <span style={{ color: "var(--success-text)" }}>Valid deck.</span>
              )}
            </div>
            <button
              type="button"
              className="mt-2 text-xs font-semibold"
              style={{ color: "var(--accent-text)" }}
              onClick={() => update(JSON.stringify(SAMPLE_DECK, null, 2))}
            >
              Reset to the sample deck
            </button>
          </div>
        </div>

        <DeckPreview deck={deck} theme={getTheme(themeId)} />
      </div>
    </div>
  );
}
