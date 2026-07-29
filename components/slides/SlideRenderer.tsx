import type { SlideNode } from "@/types/slideAst";
import type { ThemeConfig } from "@/types/theme";
import { getTheme } from "@/lib/themes";
import StandardSlide from "./StandardSlide";
import SplitColumnSlide from "./SplitColumnSlide";
import CodeExplainerSlide from "./CodeExplainerSlide";
import CalloutSlide from "./CalloutSlide";
import StepGridSlide from "./StepGridSlide";

interface Props {
  slide: SlideNode;
  theme?: ThemeConfig;
}

/**
 * Routes a single AST node to its layout component based on `slide.type`.
 * The switch is exhaustive over `SlideType` — adding a new variant to
 * `types/slideAst.ts` without a matching case here is a compile error.
 */
export default function SlideRenderer({ slide, theme = getTheme(undefined) }: Props) {
  switch (slide.type) {
    case "standard":
      return <StandardSlide slide={slide} theme={theme} />;
    case "split-column":
      return <SplitColumnSlide slide={slide} theme={theme} />;
    case "code-explainer":
      return <CodeExplainerSlide slide={slide} theme={theme} />;
    case "callout":
      return <CalloutSlide slide={slide} theme={theme} />;
    case "step-grid":
      return <StepGridSlide slide={slide} theme={theme} />;
    default: {
      // Exhaustiveness check: if a new SlideType is added to the union without a
      // matching case above, this line fails to compile (`slide` narrows to `never`).
      const _exhaustive: never = slide;
      return _exhaustive;
    }
  }
}
