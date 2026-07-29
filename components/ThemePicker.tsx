"use client";

import { THEMES } from "@/lib/themes";

interface Props {
  value: string;
  onChange: (themeId: string) => void;
}

export default function ThemePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {THEMES.map(theme => {
        const active = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            title={theme.name}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition"
            style={{
              background: active ? theme.accent.primary : "var(--bg-card-hover)",
              color: active ? "#ffffff" : "var(--text-secondary)",
              border: `1px solid ${active ? theme.accent.primary : "var(--border)"}`,
            }}
          >
            <span
              className="h-3.5 w-3.5 rounded-full shrink-0"
              style={{
                background: `linear-gradient(135deg, ${theme.accent.primary}, ${theme.accent.secondary})`,
                border: `1px solid ${active ? "#ffffff" : theme.border}`,
              }}
            />
            {theme.name}
          </button>
        );
      })}
    </div>
  );
}
