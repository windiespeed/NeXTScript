import type { StandardTextSlide } from "@/types/slideAst";
import type { ThemeConfig } from "@/types/theme";

interface Props {
  slide: StandardTextSlide;
  theme: ThemeConfig;
}

export default function StandardSlide({ slide, theme }: Props) {
  return (
    <div
      className="h-full w-full flex flex-col gap-6 p-8 md:p-12 shadow-sm"
      style={{ background: theme.background.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, fontFamily: theme.typography.bodyFont }}
    >
      <header>
        <h2
          className="text-2xl md:text-3xl leading-tight"
          style={{ color: theme.text.primary, fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }}
        >
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="mt-2 text-base md:text-lg" style={{ color: theme.text.secondary }}>
            {slide.subtitle}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {slide.paragraphs.map((paragraph, i) => (
          <p key={i} className="text-sm md:text-base leading-relaxed" style={{ color: theme.text.secondary }}>
            {paragraph}
          </p>
        ))}
      </div>

      {slide.bulletPoints && slide.bulletPoints.length > 0 && (
        <ul className="flex flex-col gap-2.5 mt-1">
          {slide.bulletPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-3 text-sm md:text-base" style={{ color: theme.text.secondary }}>
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: theme.accent.primary }}
              />
              <span className="leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
