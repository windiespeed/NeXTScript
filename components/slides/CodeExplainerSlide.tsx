import type { CodeExplainerSlide as CodeExplainerSlideNode } from "@/types/slideAst";
import type { ThemeConfig } from "@/types/theme";

interface Props {
  slide: CodeExplainerSlideNode;
  theme: ThemeConfig;
}

export default function CodeExplainerSlide({ slide, theme }: Props) {
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

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1">
        {/* Code panel stays dark regardless of theme, matching conventional code-block styling */}
        <div
          className="flex-1 overflow-hidden"
          style={{ background: "#0d1117", border: `1px solid ${theme.border}`, borderRadius: theme.radius }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wide text-white/40">
              {slide.language}
            </span>
          </div>
          <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
            <code className="font-mono text-white/90 whitespace-pre">{slide.codeSnippet}</code>
          </pre>
        </div>

        <div className="flex-1 flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: theme.accent.primary }}>
            Explanation
          </h3>
          <ul className="flex flex-col gap-2.5">
            {slide.explanationPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm md:text-base leading-relaxed" style={{ color: theme.text.secondary }}>
                <span
                  className="mt-0.5 flex items-center justify-center h-5 w-5 rounded-md text-[11px] font-semibold shrink-0"
                  style={{ background: `${theme.accent.primary}1a`, color: theme.accent.primary }}
                >
                  {i + 1}
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
