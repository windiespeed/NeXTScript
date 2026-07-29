import type { StepGridSlide as StepGridSlideNode } from "@/types/slideAst";
import type { ThemeConfig } from "@/types/theme";

interface Props {
  slide: StepGridSlideNode;
  theme: ThemeConfig;
}

export default function StepGridSlide({ slide, theme }: Props) {
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slide.steps
          .slice()
          .sort((a, b) => a.stepNumber - b.stepNumber)
          .map((step) => (
            <div
              key={step.stepNumber}
              className="flex flex-col gap-3 p-5"
              style={{ background: theme.background.cardAlt, border: `1px solid ${theme.border}`, borderRadius: theme.radius }}
            >
              <span
                className="flex items-center justify-center h-9 w-9 rounded-full text-sm font-bold shrink-0"
                style={{ background: theme.accent.primary, color: "#ffffff" }}
              >
                {step.stepNumber}
              </span>
              <h3 className="text-sm md:text-base font-semibold leading-snug" style={{ color: theme.text.primary }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: theme.text.secondary }}>
                {step.description}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
