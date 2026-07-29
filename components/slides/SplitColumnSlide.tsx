import type { SplitColumnSlide as SplitColumnSlideNode } from "@/types/slideAst";
import type { ThemeConfig } from "@/types/theme";

interface Props {
  slide: SplitColumnSlideNode;
  theme: ThemeConfig;
}

function Column({ heading, content, accent, theme }: { heading: string; content: string[]; accent: string; theme: ThemeConfig }) {
  return (
    <div
      className="flex-1 flex flex-col gap-3 p-5 md:p-6"
      style={{ background: theme.background.cardAlt, border: `1px solid ${theme.border}`, borderRadius: theme.radius }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: accent }}>
        {heading}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {content.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm md:text-base leading-relaxed" style={{ color: theme.text.secondary }}>
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SplitColumnSlide({ slide, theme }: Props) {
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

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 flex-1">
        <Column heading={slide.leftColumn.heading} content={slide.leftColumn.content} accent={theme.accent.primary} theme={theme} />
        <Column heading={slide.rightColumn.heading} content={slide.rightColumn.content} accent={theme.accent.secondary} theme={theme} />
      </div>
    </div>
  );
}
