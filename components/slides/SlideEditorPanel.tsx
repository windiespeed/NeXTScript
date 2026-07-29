"use client";

import { v4 as uuidv4 } from "uuid";
import type {
  PresentationAST,
  SlideNode,
  SlideType,
  StandardTextSlide,
  SplitColumnSlide as SplitColumnSlideNode,
  CodeExplainerSlide as CodeExplainerSlideNode,
  CalloutCardSlide,
  StepGridSlide as StepGridSlideNode,
} from "@/types/slideAst";

const inputClass = "w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const labelClass = "block text-xs font-semibold mb-1";
const labelStyle = { color: "var(--text-primary)" };

const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  standard: "Standard",
  "split-column": "Split Column",
  "code-explainer": "Code Explainer",
  callout: "Callout",
  "step-grid": "Step Grid",
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
        <label className="text-xs font-semibold" style={labelStyle}>{label}</label>
        <button type="button" onClick={() => onChange([...items, ""])} className="text-[10px] font-semibold text-[#0cc0df] hover:underline">
          + Add
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Field
              rows={rows}
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

function TitleSubtitleFields({ slide, onChange }: { slide: SlideNode; onChange: (patch: { title?: string; subtitle?: string }) => void }) {
  return (
    <>
      <div>
        <label className={labelClass} style={labelStyle}>Title</label>
        <input value={slide.title} onChange={e => onChange({ title: e.target.value })} className={inputClass} style={inputStyle} />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>
          Subtitle <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
        </label>
        <input value={slide.subtitle ?? ""} onChange={e => onChange({ subtitle: e.target.value || undefined })} className={inputClass} style={inputStyle} />
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
            <label className={labelClass} style={labelStyle}>Left Heading</label>
            <input
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
            <label className={labelClass} style={labelStyle}>Right Heading</label>
            <input
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
        <label className={labelClass} style={labelStyle}>Language</label>
        <input
          value={slide.language}
          onChange={e => onChange({ ...slide, language: e.target.value })}
          placeholder="e.g. python, javascript, java, sql"
          className={inputClass} style={inputStyle}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Code Snippet</label>
        <textarea
          value={slide.codeSnippet}
          onChange={e => onChange({ ...slide, codeSnippet: e.target.value })}
          rows={6}
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
        <label className={labelClass} style={labelStyle}>Variant</label>
        <select
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
        <label className={labelClass} style={labelStyle}>Content</label>
        <textarea value={slide.content} onChange={e => onChange({ ...slide, content: e.target.value })} rows={4} className={inputClass} style={inputStyle} />
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
        <label className="text-xs font-semibold" style={labelStyle}>Steps</label>
        <button type="button" onClick={addStep} className="text-[10px] font-semibold text-[#0cc0df] hover:underline">+ Add Step</button>
      </div>
      <div className="flex flex-col gap-2.5">
        {slide.steps.map((step, i) => (
          <div key={i} className="rounded-lg p-2.5 space-y-1.5" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--accent)" }}>#{step.stepNumber}</span>
              <input
                value={step.title}
                onChange={e => updateStep(i, { title: e.target.value })}
                placeholder="Step title"
                className={inputClass} style={inputStyle}
              />
              <button type="button" onClick={() => removeStep(i)} className="shrink-0 text-red-500 text-xs px-1.5 py-1 rounded hover:bg-red-500/10 transition" title="Remove step">
                ×
              </button>
            </div>
            <textarea
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

/** Routes the active slide to its type-specific editor form — mirrors SlideRenderer's exhaustive switch. */
function ActiveSlideEditor({ slide, onChange }: { slide: SlideNode; onChange: (next: SlideNode) => void }) {
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
    const slides = ast.slides.filter((_, i) => i !== index);
    onChange({ ...ast, slides });
    onActiveIndexChange(Math.min(activeIndex, slides.length - 1));
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ast.slides.length) return;
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
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{i + 1}. {slide.title}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{SLIDE_TYPE_LABELS[slide.type]}</p>
            </div>
            <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => moveSlide(i, -1)} disabled={i === 0} className="p-1 text-xs disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="Move up">↑</button>
              <button type="button" onClick={() => moveSlide(i, 1)} disabled={i === ast.slides.length - 1} className="p-1 text-xs disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="Move down">↓</button>
              <button type="button" onClick={() => deleteSlide(i)} disabled={ast.slides.length <= 1} className="p-1 text-xs text-red-500 disabled:opacity-30" title="Delete slide">🗑</button>
            </div>
          </div>
        ))}

        <div className="pt-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: "var(--text-muted)" }}>Add Slide</label>
          <select
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
