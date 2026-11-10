import type { ThemeConfig } from "@/types/theme";
import type { DeckContent, DeckSlide } from "@/lib/deck/schema";
import type { OverflowWarning, SlideLayout, WarningSeverity } from "@/lib/deck/layout/types";
import { hasLayout, layoutSlide } from "@/lib/deck/layout/registry";
import SlideCanvas, { WARNING_COLOR } from "./SlideCanvas";

/**
 * In-browser check for a deck: every slide drawn through the layout registry, with badges for
 * text that had to shrink or doesn't fit, and the speaker notes underneath. This is the quality
 * check that stands in for server-side rendering, since LibreOffice can't run on Vercel.
 */

type Entry = { slide: DeckSlide; layout: SlideLayout | null };

export function layoutEntries(deck: DeckContent): Entry[] {
  return deck.slides.map(slide => ({ slide, layout: hasLayout(slide.type) ? layoutSlide(slide) : null }));
}

const SEVERITY_LABEL: Record<WarningSeverity, string> = { shrunk: "Shrunk", overflow: "Overflow" };

function count(warnings: OverflowWarning[], severity: WarningSeverity) {
  return warnings.filter(w => w.severity === severity).length;
}

export function WarningBadge({ severity, n }: { severity: WarningSeverity; n: number }) {
  if (n === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: WARNING_COLOR[severity] }}
    >
      {SEVERITY_LABEL[severity]}
      {n > 1 && <span>×{n}</span>}
    </span>
  );
}

function slideTitle(slide: DeckSlide): string {
  return "title" in slide ? slide.title : slide.heading;
}

interface Props {
  deck: DeckContent;
  theme: ThemeConfig;
}

export default function DeckPreview({ deck, theme }: Props) {
  const entries = layoutEntries(deck);
  const all = entries.flatMap(e => e.layout?.warnings ?? []);
  const pending = entries.filter(e => !e.layout).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }} role="status">
        <span>
          {deck.slides.length} {deck.slides.length === 1 ? "slide" : "slides"}
        </span>
        {all.length === 0 ? (
          <span style={{ color: "var(--success-text)" }}>· everything fits</span>
        ) : (
          <>
            <span>·</span>
            <WarningBadge severity="overflow" n={count(all, "overflow")} />
            <WarningBadge severity="shrunk" n={count(all, "shrunk")} />
          </>
        )}
        {pending > 0 && <span>· {pending} waiting on layouts that aren&apos;t built yet</span>}
      </div>

      <ol className="space-y-8">
        {entries.map(({ slide, layout }, i) => {
          const label = `Slide ${i + 1}: ${slideTitle(slide)}`;
          return (
            <li key={slide.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {i + 1}
                </span>
                <span>{slide.type}</span>
                {layout && <WarningBadge severity="overflow" n={count(layout.warnings, "overflow")} />}
                {layout && <WarningBadge severity="shrunk" n={count(layout.warnings, "shrunk")} />}
              </div>

              {layout ? (
                <SlideCanvas
                  layout={layout}
                  theme={theme}
                  label={label}
                  className="rounded-xl"
                />
              ) : (
                <div
                  className="flex w-full items-center justify-center rounded-xl text-sm"
                  style={{ aspectRatio: "16 / 9", border: "1px dashed var(--border)", color: "var(--text-muted)", background: "var(--bg-card)" }}
                >
                  <span>
                    {slideTitle(slide)}: the {slide.type} layout isn&apos;t built yet
                  </span>
                </div>
              )}

              {layout && layout.warnings.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {layout.warnings.map(w => (
                    <li key={w.elementId + w.severity} className="flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span
                        aria-hidden
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: WARNING_COLOR[w.severity] }}
                      />
                      <span>
                        <span className="sr-only">{SEVERITY_LABEL[w.severity]}: </span>
                        {w.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <details className="text-sm">
                <summary className="cursor-pointer select-none text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Speaker notes
                </summary>
                <p className="mt-1 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {slide.notes}
                </p>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
