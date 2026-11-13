import type { CSSProperties } from "react";
import type { ThemeConfig } from "@/types/theme";
import type { SlideLayout, TextElement, WarningSeverity } from "@/lib/deck/layout/types";
import { CANVAS_H, CANVAS_W } from "@/lib/deck/layout/types";
import { fontFamily, resolvePalette } from "@/lib/deck/render/palette";
import { backdropFor } from "@/lib/deck/render/backdrops";

/**
 * HTML adapter for the layout registry: draws a SlideLayout at any width.
 *
 * Positions are percentages of the 720×405 canvas and sizes use container-query units
 * (1pt = 100/720 cqw), so the slide scales as one piece, like a picture of the real thing.
 * Text isn't clipped: if something overflows, you see it spill, and the element gets an outline.
 */

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** pt on the canvas → container-query width units. */
const cq = (pt: number) => `${(pt * 100) / CANVAS_W}cqw`;

export const WARNING_COLOR: Record<WarningSeverity, string> = {
  shrunk: "#d97706",
  overflow: "#dc2626",
};

const BULLET_INDENT_EM = 1.4; // matches lib/deck/layout/fit.ts

interface Props {
  layout: SlideLayout;
  theme: ThemeConfig;
  /** Outline elements that have warnings. Default true. */
  showWarnings?: boolean;
  /** Accessible name for the slide, e.g. "Slide 3: What a component is". */
  label?: string;
  className?: string;
}

export default function SlideCanvas({ layout, theme, showWarnings = true, label, className = "" }: Props) {
  const palette = resolvePalette(theme, layout.dark);
  const backdrop = backdropFor(theme.backdrop, layout.dark);
  // A course template's own gradients (as CSS) win over the built-in backdrop images.
  const templateArt = layout.cover && theme.backdropCss?.title ? theme.backdropCss.title : layout.dark ? theme.backdropCss?.dark : theme.backdropCss?.content;
  const flagged = new Map<string, WarningSeverity>();
  if (showWarnings) {
    for (const w of layout.warnings) {
      // "overflow" wins over "shrunk" if an element has both.
      if (flagged.get(w.elementId) !== "overflow") flagged.set(w.elementId, w.severity);
    }
  }

  function textStyle(el: TextElement): CSSProperties {
    return {
      color: el.hex ?? palette[el.color],
      fontFamily: el.fontFamily ? `"${el.fontFamily}", ${fontFamily(theme, el.font)}` : fontFamily(theme, el.font),
      fontWeight: el.weight ?? (el.font === "heading" ? theme.typography.headingWeight : undefined),
      fontSize: cq(el.fontSize),
      lineHeight: el.lineHeight,
      textAlign: el.align,
      display: "flex",
      flexDirection: "column",
      justifyContent: el.valign === "top" ? "flex-start" : el.valign === "middle" ? "center" : "flex-end",
      textTransform: el.uppercase ? "uppercase" : undefined,
      letterSpacing: el.letterSpacing ? cq(el.letterSpacing) : undefined,
      whiteSpace: el.font === "code" ? "pre" : "normal",
      overflowWrap: el.font === "code" ? undefined : "break-word",
    };
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        containerType: "inline-size",
        // Longhand properties only: mixing the "background" shorthand with backgroundSize makes
        // React drop the image on re-render (and warn), so the backdrop vanished from the preview.
        backgroundColor: templateArt?.color ?? palette[layout.background],
        backgroundImage: templateArt ? templateArt.image : backdrop ? `url(data:image/jpeg;base64,${backdrop})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* The template's own pictures (logos, a cover seal), under the slide's text. */}
      {templateArt?.art?.map((a, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimize
        <img
          key={i}
          src={a.src}
          alt=""
          aria-hidden
          style={{ position: "absolute", left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%`, objectFit: "fill" }}
        />
      ))}
      {layout.elements.map(el => {
        const severity = flagged.get(el.id);
        const box: CSSProperties = {
          position: "absolute",
          left: pct(el.x, CANVAS_W),
          top: pct(el.y, CANVAS_H),
          width: pct(el.w, CANVAS_W),
          height: pct(el.h, CANVAS_H),
          outline: severity ? `2px dashed ${WARNING_COLOR[severity]}` : undefined,
          outlineOffset: severity ? 2 : undefined,
        };

        if (el.kind === "rect") {
          return <div key={el.id} aria-hidden style={{ ...box, background: palette[el.fill], borderRadius: cq(el.radius) }} />;
        }

        return (
          <div key={el.id} data-element={el.id} style={{ ...box, ...textStyle(el) }}>
            {el.paragraphs.map((p, i) => (
              <p
                key={i}
                style={{
                  margin: 0,
                  marginBottom: i < el.paragraphs.length - 1 ? cq(el.paragraphGap) : 0,
                  fontWeight: p.bold ? 700 : undefined,
                  fontStyle: p.italic ? "italic" : undefined,
                  color: p.color ? palette[p.color] : undefined,
                  position: p.bullet ? "relative" : undefined,
                  paddingLeft: p.bullet ? `${BULLET_INDENT_EM}em` : undefined,
                }}
              >
                {p.bullet && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "0.35em",
                      top: `${(el.lineHeight - 0.36) / 2}em`,
                      width: "0.36em",
                      height: "0.36em",
                      borderRadius: "50%",
                      background: palette["accent.primary"],
                    }}
                  />
                )}
                {p.text}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
