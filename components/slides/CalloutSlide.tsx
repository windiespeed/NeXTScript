import type { CalloutCardSlide } from "@/types/slideAst";
import type { ThemeConfig } from "@/types/theme";

interface Props {
  slide: CalloutCardSlide;
  theme: ThemeConfig;
}

const WARNING_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TIP_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" /><path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.75.76 1.23 1.52 1.41 2.5" />
  </svg>
);

const INSTRUCTOR_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

const VARIANT_META = {
  warning: { label: "Heads Up", icon: WARNING_ICON },
  tip: { label: "Pro Tip", icon: TIP_ICON },
  "instructor-note": { label: "Instructor Note", icon: INSTRUCTOR_ICON },
} as const;

/** Maps each variant to one of the theme's three accent slots. */
function accentFor(variant: CalloutCardSlide["variant"], theme: ThemeConfig): string {
  if (variant === "tip") return theme.accent.primary;
  if (variant === "warning") return theme.accent.secondary;
  return theme.accent.tertiary;
}

export default function CalloutSlide({ slide, theme }: Props) {
  const meta = VARIANT_META[slide.variant];
  const accent = accentFor(slide.variant, theme);
  const bg = `${accent}1a`; // ~10% opacity tint, same technique used across this component set

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center gap-6 p-8 md:p-12 shadow-sm"
      style={{ background: theme.background.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, fontFamily: theme.typography.bodyFont }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center text-center gap-5">
        <div
          className="flex items-center justify-center h-16 w-16 rounded-full shrink-0"
          style={{ background: bg, color: accent }}
        >
          {meta.icon}
        </div>

        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{ background: bg, color: accent }}
        >
          {meta.label}
        </span>

        <h2
          className="text-2xl md:text-3xl leading-tight"
          style={{ color: theme.text.primary, fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }}
        >
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="text-base md:text-lg" style={{ color: theme.text.secondary }}>
            {slide.subtitle}
          </p>
        )}

        <p
          className="text-base md:text-lg leading-relaxed px-6 py-5"
          style={{ background: bg, color: theme.text.primary, border: `1px solid ${accent}33`, borderRadius: theme.radius }}
        >
          {slide.content}
        </p>
      </div>
    </div>
  );
}
