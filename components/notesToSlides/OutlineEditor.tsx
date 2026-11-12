"use client";

import type { Outline, OutlineItem } from "@/lib/ingestionPrompt";
import type { SlideType } from "@/types/slideAst";

/**
 * The reviewed plan for a Notes to Slides deck: one row per slide with its headline, layout and
 * a line on what it covers. Course sections stay in place and can't be removed; everything else
 * can be edited, removed, or added before the deck is written from it.
 */

export const LAYOUT_LABELS: Record<SlideType, string> = {
  standard: "Text and bullets",
  "card-row": "Card row",
  "split-column": "Two columns",
  table: "Table",
  "step-grid": "Steps",
  "code-explainer": "Code",
  callout: "Callout",
};

const inputClass = "w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

interface Props {
  outline: Outline;
  onChange: (outline: Outline) => void;
}

export default function OutlineEditor({ outline, onChange }: Props) {
  function update(i: number, patch: Partial<OutlineItem>) {
    onChange({ ...outline, slides: outline.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }
  function remove(i: number) {
    if (outline.slides[i]?.anchorId) return;
    onChange({ ...outline, slides: outline.slides.filter((_, j) => j !== i) });
  }
  function addAfter(i: number) {
    const label = outline.slides[i]?.label;
    const slides = [...outline.slides];
    slides.splice(i + 1, 0, { title: "", type: "standard", ...(label ? { label } : {}) });
    onChange({ ...outline, slides });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Cover title
          <input value={outline.lessonTitle} onChange={e => onChange({ ...outline, lessonTitle: e.target.value })} className={`${inputClass} mt-1`} style={inputStyle} />
        </label>
        <label className="block text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Cover tagline <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
          <input value={outline.lessonSubtitle ?? ""} onChange={e => onChange({ ...outline, lessonSubtitle: e.target.value || undefined })} className={`${inputClass} mt-1`} style={inputStyle} />
        </label>
      </div>
      <ol className="space-y-2">
        {outline.slides.map((item, i) => (
          <li key={i} className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tabular-nums w-5 shrink-0" style={{ color: "var(--accent-text)" }}>{i + 1}</span>
              {item.label && (
                <span className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-muted)" }} title={item.anchorId ? "Course section (locked)" : undefined}>
                  {item.anchorId ? "🔒 " : ""}{item.label}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => addAfter(i)} className="text-[10px] font-semibold px-1.5 py-0.5 rounded hover:underline" style={{ color: "var(--accent-text)" }} title="Add a slide after this one">
                  + Slide
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={!!item.anchorId}
                  className="text-xs px-1.5 py-0.5 rounded text-red-500 hover:bg-red-500/10 disabled:opacity-30"
                  title={item.anchorId ? "Course sections can't be removed" : "Remove this slide"}
                  aria-label={`Remove slide ${i + 1}`}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-2">
              <input
                aria-label={`Slide ${i + 1} headline`}
                value={item.title}
                onChange={e => update(i, { title: e.target.value })}
                placeholder="Headline"
                className={`${inputClass} font-semibold`}
                style={inputStyle}
              />
              <select
                aria-label={`Slide ${i + 1} layout`}
                value={item.type ?? ""}
                onChange={e => update(i, { type: (e.target.value || undefined) as SlideType | undefined })}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Any layout</option>
                {(Object.keys(LAYOUT_LABELS) as SlideType[]).map(t => (
                  <option key={t} value={t}>{LAYOUT_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <input
              aria-label={`Slide ${i + 1} covers`}
              value={item.summary ?? ""}
              onChange={e => update(i, { summary: e.target.value || undefined })}
              placeholder="What this slide covers"
              className={inputClass}
              style={inputStyle}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
