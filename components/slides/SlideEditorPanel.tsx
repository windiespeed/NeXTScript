"use client";

import { v4 as uuidv4 } from "uuid";
import { wouldBreakAnchorOrder } from "@/lib/slideAnchors";
import type {
  PresentationAST,
  SlideNode,
  SlideType,
  StandardTextSlide,
  SplitColumnSlide as SplitColumnSlideNode,
  CodeExplainerSlide as CodeExplainerSlideNode,
  CalloutCardSlide,
  StepGridSlide as StepGridSlideNode,
  CardRowSlide,
  TableSlide,
} from "@/types/slideAst";

const inputClass = "w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const labelClass = "block text-xs font-semibold mb-1";
const labelStyle = { color: "var(--text-primary)" };

const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  standard: "Text and Bullets",
  "card-row": "Card Row",
  "split-column": "Two Columns",
  table: "Table",
  "step-grid": "Steps",
  "code-explainer": "Code",
  callout: "Callout",
};

function blankSlide(type: SlideType): SlideNode {
  const id = uuidv4();
  switch (type) {
    case "standard":
      return { id, type: "standard", title: "New Slide", paragraphs: [""] };
    case "split-column":
      return {
        id, type: "split-column", title: "New Slide",
        leftColumn: { heading: "Left", content: [""] },
        rightColumn: { heading: "Right", content: [""] },
      };
    case "code-explainer":
      return { id, type: "code-explainer", title: "New Slide", language: "", codeSnippet: "", explanationPoints: [""] };
    case "callout":
      return { id, type: "callout", title: "New Slide", variant: "tip", content: "" };
    case "step-grid":
      return { id, type: "step-grid", title: "New Slide", steps: [{ stepNumber: 1, title: "", description: "" }] };
    case "card-row":
      return { id, type: "card-row", title: "New Slide", cards: [{ heading: "", body: "" }, { heading: "", body: "" }] };
    case "table":
      return { id, type: "table", title: "New Slide", columns: ["", ""], rows: [["", ""]] };
  }
}

interface Props {
  ast: PresentationAST;
  activeIndex: number;
  onChange: (ast: PresentationAST) => void;
  onActiveIndexChange: (index: number) => void;
}

function TextListField({ label, items, onChange, rows }: { label: string; items: string[]; onChange: (items: string[]) => void; rows?: number }) {
  const Field = rows ? "textarea" : "input";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold" style={labelStyle}>{label}</span>
        <button type="button" aria-label={`Add ${label} item`} onClick={() => onChange([...items, ""])} className="text-[10px] font-semibold text-[var(--accent-text)] hover:underline">
          + Add
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Field
              rows={rows}
              aria-label={`${label} ${i + 1}`}
              value={item}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className={inputClass}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="shrink-0 text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-500/10 transition"
              title="Remove"
              aria-label={`Remove ${label} ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>No items yet — click &quot;+ Add&quot;.</p>}
      </div>
    </div>
  );
}

type SlidePatch = Partial<Pick<SlideNode, "title" | "subtitle" | "label" | "notes" | "takeaway">>;

/** Fields every slide has: section label, headline, and (under the type's own fields) notes and takeaway. */
function TitleSubtitleFields({ slide, onChange }: { slide: SlideNode; onChange: (patch: SlidePatch) => void }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2">
        <div>
          <label htmlFor="slides-slideeditorpanel-label" className={labelClass} style={labelStyle}>
            Section label{slide.anchorId && <span className="font-normal" style={{ color: "var(--text-muted)" }}> · 🔒 course section</span>}
          </label>
          {/* Anchored slides carry the exact course section name in their label — the export
              enforces it too, so it's read-only here. The headline is free to edit. */}
          <input id="slides-slideeditorpanel-label"
            value={slide.label ?? ""}
            readOnly={!!slide.anchorId}
            title={slide.anchorId ? "This label comes from the course's Sections and can't be changed here." : "Small label above the title"}
            onChange={e => { if (!slide.anchorId) onChange({ label: e.target.value || undefined }); }}
            className={`${inputClass} ${slide.anchorId ? "cursor-not-allowed opacity-70" : ""}`}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="slides-slideeditorpanel-title" className={labelClass} style={labelStyle}>Headline</label>
          <input id="slides-slideeditorpanel-title" value={slide.title} onChange={e => onChange({ title: e.target.value })} className={inputClass} style={inputStyle} />
        </div>
      </div>
    </>
  );
}

/** Takeaway line and speaker notes, shown under each slide type's own fields. */
function NotesFields({ slide, onChange }: { slide: SlideNode; onChange: (patch: SlidePatch) => void }) {
  return (
    <>
      {slide.type !== "callout" && (
        <div>
          <label htmlFor="slides-slideeditorpanel-takeaway" className={labelClass} style={labelStyle}>
            Takeaway <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional, one short sentence at the bottom)</span>
          </label>
          <input id="slides-slideeditorpanel-takeaway" value={slide.takeaway ?? ""} onChange={e => onChange({ takeaway: e.target.value || undefined })} className={inputClass} style={inputStyle} />
        </div>
      )}
      <div>
        <label htmlFor="slides-slideeditorpanel-notes" className={labelClass} style={labelStyle}>
          Speaker notes <span className="font-normal" style={{ color: "var(--text-muted)" }}>(not shown on the slide)</span>
        </label>
        <textarea id="slides-slideeditorpanel-notes" value={slide.notes ?? ""} onChange={e => onChange({ notes: e.target.value || undefined })} rows={4} className={inputClass} style={inputStyle} />
      </div>
    </>
  );
}

function StandardEditor({ slide, onChange }: { slide: StandardTextSlide; onChange: (next: StandardTextSlide) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TitleSubtitleFields slide={slide} onChange={patch => onChange({ ...slide, ...patch })} />
      <TextListField label="Paragraphs" items={slide.paragraphs} rows={2} onChange={paragraphs => onChange({ ...slide, paragraphs })} />
      <TextListField label="Bullet Points" items={slide.bulletPoints ?? []} onChange={bulletPoints => onChange({ ...slide, bulletPoints })} />
    </div>
  );
}

function SplitColumnEditor({ slide, onChange }: { slide: SplitColumnSlideNode; onChange: (next: SplitColumnSlideNode) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TitleSubtitleFields slide={slide} onChange={patch => onChange({ ...slide, ...patch })} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <div>
            <label htmlFor="slides-slideeditorpanel-left-heading" className={labelClass} style={labelStyle}>Left Heading</label>
            <input id="slides-slideeditorpanel-left-heading"
              value={slide.leftColumn.heading}
              onChange={e => onChange({ ...slide, leftColumn: { ...slide.leftColumn, heading: e.target.value } })}
              className={inputClass} style={inputStyle}
            />
          </div>
          <TextListField
            label="Left Content"
            items={slide.leftColumn.content}
            onChange={content => onChange({ ...slide, leftColumn: { ...slide.leftColumn, content } })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <label htmlFor="slides-slideeditorpanel-right-heading" className={labelClass} style={labelStyle}>Right Heading</label>
            <input id="slides-slideeditorpanel-right-heading"
              value={slide.rightColumn.heading}
              onChange={e => onChange({ ...slide, rightColumn: { ...slide.rightColumn, heading: e.target.value } })}
              className={inputClass} style={inputStyle}
            />
          </div>
          <TextListField
            label="Right Content"
            items={slide.rightColumn.content}
            onChange={content => onChange({ ...slide, rightColumn: { ...slide.rightColumn, content } })}
          />
        </div>
      </div>
    </div>
  );
}

function CodeExplainerEditor({ slide, onChange }: { slide: CodeExplainerSlideNode; onChange: (next: CodeExplainerSlideNode) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TitleSubtitleFields slide={slide} onChange={patch => onChange({ ...slide, ...patch })} />
      <div>
        <label htmlFor="slides-slideeditorpanel-language" className={labelClass} style={labelStyle}>Language</label>
        <input id="slides-slideeditorpanel-language"
          value={slide.language}
          onChange={e => onChange({ ...slide, language: e.target.value })}
          placeholder="e.g. python, javascript, java, sql"
          className={inputClass} style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="slides-slideeditorpanel-code-snippet" className={labelClass} style={labelStyle}>Code Snippet</label>
        <textarea id="slides-slideeditorpanel-code-snippet"
          value={slide.codeSnippet}
          onChange={e => onChange({ ...slide, codeSnippet: e.target.value })}
          rows={6}
          className={`${inputClass} font-mono`}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="slides-slideeditorpanel-output" className={labelClass} style={labelStyle}>
          Output <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional, what running it shows)</span>
        </label>
        <textarea id="slides-slideeditorpanel-output"
          value={slide.output ?? ""}
          onChange={e => onChange({ ...slide, output: e.target.value || undefined })}
          rows={2}
          className={`${inputClass} font-mono`}
          style={inputStyle}
        />
      </div>
      <TextListField label="Explanation Points" items={slide.explanationPoints} onChange={explanationPoints => onChange({ ...slide, explanationPoints })} />
    </div>
  );
}

function CalloutEditor({ slide, onChange }: { slide: CalloutCardSlide; onChange: (next: CalloutCardSlide) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TitleSubtitleFields slide={slide} onChange={patch => onChange({ ...slide, ...patch })} />
      <div>
        <label htmlFor="slides-slideeditorpanel-variant" className={labelClass} style={labelStyle}>Variant</label>
        <select id="slides-slideeditorpanel-variant"
          value={slide.variant}
          onChange={e => onChange({ ...slide, variant: e.target.value as CalloutCardSlide["variant"] })}
          className={inputClass} style={inputStyle}
        >
          <option value="warning">Warning</option>
          <option value="tip">Tip</option>
          <option value="instructor-note">Instructor Note</option>
        </select>
      </div>
      <div>
        <label htmlFor="slides-slideeditorpanel-content" className={labelClass} style={labelStyle}>Content</label>
        <textarea id="slides-slideeditorpanel-content" value={slide.content} onChange={e => onChange({ ...slide, content: e.target.value })} rows={4} className={inputClass} style={inputStyle} />
      </div>
    </div>
  );
}

function StepGridEditor({ slide, onChange }: { slide: StepGridSlideNode; onChange: (next: StepGridSlideNode) => void }) {
  function updateStep(i: number, patch: Partial<StepGridSlideNode["steps"][number]>) {
    const steps = slide.steps.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onChange({ ...slide, steps });
  }
  function addStep() {
    onChange({ ...slide, steps: [...slide.steps, { stepNumber: slide.steps.length + 1, title: "", description: "" }] });
  }
  function removeStep(i: number) {
    const steps = slide.steps.filter((_, j) => j !== i).map((s, j) => ({ ...s, stepNumber: j + 1 }));
    onChange({ ...slide, steps });
  }

  return (
    <div className="flex flex-col gap-3">
      <TitleSubtitleFields slide={slide} onChange={patch => onChange({ ...slide, ...patch })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={labelStyle}>Steps</span>
        <button type="button" onClick={addStep} className="text-[10px] font-semibold text-[var(--accent-text)] hover:underline">+ Add Step</button>
      </div>
      <div className="flex flex-col gap-2.5">
        {slide.steps.map((step, i) => (
          <div key={i} className="rounded-lg p-2.5 space-y-1.5" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--accent)" }}>#{step.stepNumber}</span>
              <input aria-label={`Step ${i + 1} title`}
                value={step.title}
                onChange={e => updateStep(i, { title: e.target.value })}
                placeholder="Step title"
                className={inputClass} style={inputStyle}
              />
              <button type="button" onClick={() => removeStep(i)} className="shrink-0 text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-500/10 transition" title="Remove step">
                ×
              </button>
            </div>
            <textarea aria-label={`Step ${i + 1} description`}
              value={step.description}
              onChange={e => updateStep(i, { description: e.target.value })}
              placeholder="Step description"
              rows={2}
              className={inputClass} style={inputStyle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardRowEditor({ slide, onChange }: { slide: CardRowSlide; onChange: (next: CardRowSlide) => void }) {
  function updateCard(i: number, patch: Partial<CardRowSlide["cards"][number]>) {
    onChange({ ...slide, cards: slide.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  }
  return (
    <div className="flex flex-col gap-3">
      <TitleSubtitleFields slide={slide} onChange={patch => onChange({ ...slide, ...patch })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={labelStyle}>Cards <span className="font-normal" style={{ color: "var(--text-muted)" }}>(2–4 fit in a row)</span></span>
        <button type="button" onClick={() => onChange({ ...slide, cards: [...slide.cards, { heading: "", body: "" }] })} className="text-[10px] font-semibold text-[var(--accent-text)] hover:underline">+ Add Card</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {slide.cards.map((card, i) => (
          <div key={i} className="rounded-lg p-2.5 space-y-1.5" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5">
              <input aria-label={`Card ${i + 1} tag`} value={card.tag ?? ""} onChange={e => updateCard(i, { tag: e.target.value || undefined })} placeholder="Tag (optional)" className={inputClass} style={inputStyle} />
              <button type="button" onClick={() => onChange({ ...slide, cards: slide.cards.filter((_, j) => j !== i) })} className="shrink-0 text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-500/10 transition" title="Remove card" aria-label={`Remove card ${i + 1}`}>×</button>
            </div>
            <input aria-label={`Card ${i + 1} heading`} value={card.heading} onChange={e => updateCard(i, { heading: e.target.value })} placeholder="Heading" className={inputClass} style={inputStyle} />
            <textarea aria-label={`Card ${i + 1} text`} value={card.body} onChange={e => updateCard(i, { body: e.target.value })} placeholder="Text" rows={2} className={inputClass} style={inputStyle} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableEditor({ slide, onChange }: { slide: TableSlide; onChange: (next: TableSlide) => void }) {
  const cols = slide.columns.length;
  function setCell(r: number, c: number, value: string) {
    onChange({ ...slide, rows: slide.rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? value : row[j] ?? "")) : row)) });
  }
  function addColumn() {
    if (cols >= 4) return;
    onChange({ ...slide, columns: [...slide.columns, ""], rows: slide.rows.map(r => [...r, ""]) });
  }
  function removeColumn(c: number) {
    if (cols <= 2) return;
    onChange({ ...slide, columns: slide.columns.filter((_, j) => j !== c), rows: slide.rows.map(r => r.filter((_, j) => j !== c)) });
  }
  return (
    <div className="flex flex-col gap-3">
      <TitleSubtitleFields slide={slide} onChange={patch => onChange({ ...slide, ...patch })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={labelStyle}>Table <span className="font-normal" style={{ color: "var(--text-muted)" }}>(2–4 columns, up to 5 rows per slide; more rows continue on the next slide)</span></span>
        <div className="flex gap-3">
          <button type="button" onClick={addColumn} disabled={cols >= 4} className="text-[10px] font-semibold text-[var(--accent-text)] hover:underline disabled:opacity-40">+ Column</button>
          <button type="button" onClick={() => onChange({ ...slide, rows: [...slide.rows, Array.from({ length: cols }, () => "")] })} className="text-[10px] font-semibold text-[var(--accent-text)] hover:underline">+ Row</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: "4px" }}>
          <thead>
            <tr>
              {slide.columns.map((h, c) => (
                <th key={c} className="align-top">
                  <div className="flex items-center gap-1">
                    <input aria-label={`Column ${c + 1} heading`} value={h} onChange={e => onChange({ ...slide, columns: slide.columns.map((x, j) => (j === c ? e.target.value : x)) })} placeholder="Heading" className={`${inputClass} font-semibold`} style={inputStyle} />
                    <button type="button" onClick={() => removeColumn(c)} disabled={cols <= 2} className="shrink-0 text-red-500 text-xs px-1 rounded hover:bg-red-500/10 disabled:opacity-30" title="Remove column" aria-label={`Remove column ${c + 1}`}>×</button>
                  </div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {slide.rows.map((row, r) => (
              <tr key={r}>
                {slide.columns.map((_, c) => (
                  <td key={c}>
                    <input aria-label={`Row ${r + 1}, column ${c + 1}`} value={row[c] ?? ""} onChange={e => setCell(r, c, e.target.value)} className={inputClass} style={inputStyle} />
                  </td>
                ))}
                <td>
                  <button type="button" onClick={() => onChange({ ...slide, rows: slide.rows.filter((_, j) => j !== r) })} className="text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-500/10" title="Remove row" aria-label={`Remove row ${r + 1}`}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Routes the active slide to its type-specific editor form. */
function ActiveSlideEditor({ slide, onChange }: { slide: SlideNode; onChange: (next: SlideNode) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <SlideTypeEditor slide={slide} onChange={onChange} />
      <NotesFields slide={slide} onChange={patch => onChange({ ...slide, ...patch } as SlideNode)} />
    </div>
  );
}

function SlideTypeEditor({ slide, onChange }: { slide: SlideNode; onChange: (next: SlideNode) => void }) {
  switch (slide.type) {
    case "standard":
      return <StandardEditor slide={slide} onChange={onChange} />;
    case "split-column":
      return <SplitColumnEditor slide={slide} onChange={onChange} />;
    case "code-explainer":
      return <CodeExplainerEditor slide={slide} onChange={onChange} />;
    case "callout":
      return <CalloutEditor slide={slide} onChange={onChange} />;
    case "step-grid":
      return <StepGridEditor slide={slide} onChange={onChange} />;
    case "card-row":
      return <CardRowEditor slide={slide} onChange={onChange} />;
    case "table":
      return <TableEditor slide={slide} onChange={onChange} />;
    default: {
      const _exhaustive: never = slide;
      return _exhaustive;
    }
  }
}

export default function SlideEditorPanel({ ast, activeIndex, onChange, onActiveIndexChange }: Props) {
  const activeSlide = ast.slides[activeIndex];

  function updateActiveSlide(next: SlideNode) {
    const slides = ast.slides.map((s, i) => (i === activeIndex ? next : s));
    onChange({ ...ast, slides });
  }

  function addSlide(type: SlideType) {
    const slides = [...ast.slides];
    const insertAt = activeIndex + 1;
    slides.splice(insertAt, 0, blankSlide(type));
    onChange({ ...ast, slides });
    onActiveIndexChange(insertAt);
  }

  function deleteSlide(index: number) {
    if (ast.slides.length <= 1) return; // always keep at least one slide
    if (ast.slides[index]?.anchorId) return; // locked course anchor
    const slides = ast.slides.filter((_, i) => i !== index);
    onChange({ ...ast, slides });
    onActiveIndexChange(Math.min(activeIndex, slides.length - 1));
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ast.slides.length) return;
    if (wouldBreakAnchorOrder(ast.slides, index, target)) return; // anchors keep course order
    const slides = [...ast.slides];
    [slides[index], slides[target]] = [slides[target], slides[index]];
    onChange({ ...ast, slides });
    if (activeIndex === index) onActiveIndexChange(target);
    else if (activeIndex === target) onActiveIndexChange(index);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Slide list + management controls */}
      <div className="lg:w-64 shrink-0 flex flex-col gap-2">
        {ast.slides.map((slide, i) => (
          <div
            key={slide.id}
            onClick={() => onActiveIndexChange(i)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition"
            style={{
              background: i === activeIndex ? "var(--accent-bg)" : "var(--bg-card-hover)",
              border: `1px solid ${i === activeIndex ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {i + 1}. {slide.anchorId && <span title="Locked course section">🔒 </span>}{slide.title}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{SLIDE_TYPE_LABELS[slide.type]}</p>
            </div>
            <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => moveSlide(i, -1)} disabled={i === 0 || wouldBreakAnchorOrder(ast.slides, i, i - 1)} className="p-1 text-xs disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="Move up">↑</button>
              <button type="button" onClick={() => moveSlide(i, 1)} disabled={i === ast.slides.length - 1 || wouldBreakAnchorOrder(ast.slides, i, i + 1)} className="p-1 text-xs disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="Move down">↓</button>
              <button type="button" onClick={() => deleteSlide(i)} disabled={ast.slides.length <= 1 || !!slide.anchorId} className="p-1 text-xs text-red-500 disabled:opacity-30" title={slide.anchorId ? "Course sections can't be deleted" : "Delete slide"}>🗑</button>
            </div>
          </div>
        ))}

        <div className="pt-1">
          <label htmlFor="slides-slideeditorpanel-add-slide" className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: "var(--text-muted)" }}>Add Slide</label>
          <select id="slides-slideeditorpanel-add-slide"
            value=""
            onChange={e => { if (e.target.value) addSlide(e.target.value as SlideType); }}
            className={inputClass} style={inputStyle}
          >
            <option value="">Choose a layout…</option>
            {(Object.keys(SLIDE_TYPE_LABELS) as SlideType[]).map(type => (
              <option key={type} value={type}>{SLIDE_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active slide field editor */}
      <div className="flex-1 rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {activeSlide ? (
          <ActiveSlideEditor slide={activeSlide} onChange={updateActiveSlide} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No slide selected.</p>
        )}
      </div>
    </div>
  );
}
