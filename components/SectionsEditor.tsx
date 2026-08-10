"use client";

import { useState } from "react";
import { DEFAULT_SECTIONS, BUILTIN_SECTION_IDS, isBuiltinId, type SectionDef } from "@/types/section";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

interface Props {
  /** The resolved, currently-active section list to display — including synthesized defaults
   * when the course/user hasn't customized yet. */
  value: SectionDef[];
  /** Called with the full replacement list on any edit — the caller persists it as-is. */
  onChange: (next: SectionDef[]) => void;
  /** Course-level lists get the "Include in Overview Doc" toggle per section; user-level
   * (Profile) defaults don't, since that toggle only makes sense scoped to a course. */
  scope: "user" | "course";
}

function newCustomSection(): SectionDef {
  return {
    id: `s_${crypto.randomUUID()}`,
    label: "",
    position: "after-slides",
    includeInOverviewDoc: false,
    includeInQuizContext: true,
  };
}

export default function SectionsEditor({ value, onChange, scope }: Props) {
  const [restorePickerOpen, setRestorePickerOpen] = useState(false);
  const removedBuiltinIds = BUILTIN_SECTION_IDS.filter(id => !value.some(s => s.id === id));

  function update(id: string, patch: Partial<SectionDef>) {
    onChange(value.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function move(index: number, direction: "up" | "down") {
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= value.length) return;
    const next = [...value];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    onChange(next);
  }

  function remove(id: string) {
    // Never deletes stored lesson content — just drops the id from the active list. Restoring
    // a removed builtin by its stable id (below) reunites it with any content still saved
    // under that id on individual lessons.
    onChange(value.filter(s => s.id !== id));
  }

  function addCustom() {
    onChange([...value, newCustomSection()]);
  }

  function restore(id: typeof BUILTIN_SECTION_IDS[number]) {
    const def = DEFAULT_SECTIONS.find(s => s.id === id);
    if (def) onChange([...value, def]);
    setRestorePickerOpen(false);
  }

  function resetToDefaults() {
    onChange(DEFAULT_SECTIONS);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>
          {scope === "course"
            ? "Sections used for this course's lessons — Slide Deck, Overview Doc, AI Fill, and quiz generation."
            : "Default sections for new courses — a course can add, remove, or rename its own."}
        </p>
        <button type="button" onClick={resetToDefaults} className="text-xs shrink-0 hover:underline" style={{ color: "#0cc0df" }}>
          Reset to defaults
        </button>
      </div>

      <div className="space-y-2">
        {value.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div className="flex flex-col shrink-0">
              <button type="button" onClick={() => move(i, "up")} disabled={i === 0} title="Move up" className="p-0.5 rounded text-[var(--text-muted)] hover:text-[#0cc0df] disabled:opacity-20 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button type="button" onClick={() => move(i, "down")} disabled={i === value.length - 1} title="Move down" className="p-0.5 rounded text-[var(--text-muted)] hover:text-[#0cc0df] disabled:opacity-20 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <input
              type="text"
              value={s.label}
              onChange={e => update(s.id, { label: e.target.value })}
              placeholder={isBuiltinId(s.id) ? undefined : "New section name"}
              className={inputClass}
              style={inputStyle}
            />
            {scope === "course" && (
              <label className="flex items-center gap-1.5 shrink-0 text-[10px] font-semibold cursor-pointer select-none" style={{ color: "var(--text-secondary)" }} title="Include this section's content in the generated Overview Doc">
                <input
                  type="checkbox"
                  checked={s.includeInOverviewDoc}
                  onChange={e => update(s.id, { includeInOverviewDoc: e.target.checked })}
                  className="accent-[#0cc0df] w-3.5 h-3.5"
                />
                Overview Doc
              </label>
            )}
            <button
              type="button"
              onClick={() => remove(s.id)}
              title="Remove — stored lesson content is kept and can be restored later"
              className="p-1 rounded-full shrink-0 hover:text-red-500 transition"
              style={{ color: "var(--text-muted)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        ))}
        {value.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>No sections — add one below.</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={addCustom}
          className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
          style={{ background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          + New Section
        </button>
        {removedBuiltinIds.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setRestorePickerOpen(v => !v)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Restore Removed Section
            </button>
            {restorePickerOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setRestorePickerOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-30 rounded-2xl overflow-hidden min-w-[200px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}>
                  {removedBuiltinIds.map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => restore(id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card-hover)] transition"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {DEFAULT_SECTIONS.find(s => s.id === id)?.label ?? id}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
