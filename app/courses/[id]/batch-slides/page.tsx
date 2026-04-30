"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Course, CourseModule } from "@/types/course";
import type { Lesson } from "@/types/lesson";

const inputClass = "rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const sectionHeading = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

type LessonStatus = "idle" | "filling" | "saving" | "generating" | "done" | "error";

interface LessonProgress {
  status: LessonStatus;
  message: string;
}

function serializeSlides(slides: { title: string; body: string }[]): string {
  return slides.map(s => `${s.title}\n${s.body}`).join("\n---\n");
}

function StatusDot({ status }: { status: LessonStatus }) {
  const colors: Record<LessonStatus, string> = {
    idle: "var(--border)",
    filling: "#0cc0df",
    saving: "#0cc0df",
    generating: "#ff8c4a",
    done: "#2dd4a0",
    error: "#ef4444",
  };
  const pulse = status === "filling" || status === "saving" || status === "generating";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: colors[status] }}
    />
  );
}

export default function BatchSlidesPage() {
  useSession({ required: true });
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [doAiFill, setDoAiFill] = useState(true);
  const [doGenerate, setDoGenerate] = useState(true);
  const [slideCount, setSlideCount] = useState(10);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${courseId}`).then(r => r.json()),
      fetch(`/api/lessons?courseId=${courseId}`).then(r => r.json()),
      fetch("/api/user/settings").then(r => r.json()),
    ]).then(([courseData, lessonData, settings]) => {
      setCourse(courseData);
      setLessons(Array.isArray(lessonData) ? lessonData : []);
      setHasAiKey(settings.hasKey ?? false);
      if (!settings.hasKey) setDoAiFill(false);
      setLoading(false);
    });
  }, [courseId]);

  const modules: CourseModule[] = course?.modules ?? [];
  const unassigned = lessons.filter(l => !modules.some(m => m.lessonIds.includes(l.id)));

  function toggleLesson(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleModule(lessonIds: string[]) {
    const group = lessons.filter(l => lessonIds.includes(l.id));
    const allSelected = group.every(l => selectedIds.has(l.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      group.forEach(l => allSelected ? next.delete(l.id) : next.add(l.id));
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(lessons.map(l => l.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function setLessonProgress(id: string, status: LessonStatus, message: string) {
    setProgress(p => ({ ...p, [id]: { status, message } }));
  }

  async function handleRun() {
    if (selectedIds.size === 0 || (!doAiFill && !doGenerate)) return;
    setRunning(true);
    setFinished(false);
    setProgress({});

    const ordered = [
      ...modules.flatMap(m => lessons.filter(l => m.lessonIds.includes(l.id) && selectedIds.has(l.id))),
      ...unassigned.filter(l => selectedIds.has(l.id)),
    ];

    for (const lesson of ordered) {
      let updatedSlideContent = lesson.slideContent ?? "";
      let updatedSlideCount = slideCount;

      if (doAiFill) {
        setLessonProgress(lesson.id, "filling", "AI filling content…");
        try {
          const res = await fetch("/api/ai/lesson", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...lesson, slideCount }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();

          if (Array.isArray(data.slides) && data.slides.length > 0) {
            updatedSlideContent = serializeSlides(data.slides);
            updatedSlideCount = data.slides.length;

            setLessonProgress(lesson.id, "saving", "Saving content…");
            const saveRes = await fetch(`/api/lessons/${lesson.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                overview: data.overview ?? lesson.overview,
                learningTargets: data.learningTargets ?? lesson.learningTargets,
                vocabulary: data.vocabulary ?? lesson.vocabulary,
                warmUp: data.warmUp ?? lesson.warmUp,
                guidedLab: data.guidedLab ?? lesson.guidedLab,
                selfPaced: data.selfPaced ?? lesson.selfPaced,
                submissionChecklist: data.submissionChecklist ?? lesson.submissionChecklist,
                checkpoint: data.checkpoint ?? lesson.checkpoint,
                industryBestPractices: data.industryBestPractices ?? lesson.industryBestPractices,
                devJournalPrompt: data.devJournalPrompt ?? lesson.devJournalPrompt,
                rubric: data.rubric ?? lesson.rubric,
                slideContent: updatedSlideContent,
                slideCount: updatedSlideCount,
                overviewSlides: Array(data.slides.length).fill(false),
              }),
            });
            if (!saveRes.ok) throw new Error("Failed to save slide content.");
          }
        } catch (e: any) {
          setLessonProgress(lesson.id, "error", e.message || "AI fill failed.");
          continue;
        }
      }

      if (doGenerate) {
        if (!updatedSlideContent.trim()) {
          setLessonProgress(lesson.id, "error", "No slide content to generate from.");
          continue;
        }
        setLessonProgress(lesson.id, "generating", "Generating Google Slides…");
        try {
          const res = await fetch(`/api/generate/${lesson.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: ["slides"], destination: "drive" }),
          });
          if (!res.ok) throw new Error("Generation failed.");
          setLessonProgress(lesson.id, "done", "Done — slides generated.");
        } catch (e: any) {
          setLessonProgress(lesson.id, "error", e.message || "Generation failed.");
          continue;
        }
      } else {
        setLessonProgress(lesson.id, "done", "Slides filled and saved.");
      }
    }

    setRunning(false);
    setFinished(true);
  }

  const doneCount = Object.values(progress).filter(p => p.status === "done").length;
  const errorCount = Object.values(progress).filter(p => p.status === "error").length;
  const totalSelected = selectedIds.size;
  const canRun = totalSelected > 0 && (doAiFill || doGenerate) && !running;

  function renderLessonRow(lesson: Lesson) {
    const prog = progress[lesson.id];
    const checked = selectedIds.has(lesson.id);
    return (
      <div key={lesson.id}
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl transition"
        style={{ background: checked ? "var(--accent-bg)" : "transparent" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggleLesson(lesson.id)}
          disabled={running}
          className="accent-[#0cc0df] w-3.5 h-3.5 shrink-0"
        />
        <span className="flex-1 text-xs truncate" style={{ color: "var(--text-primary)" }}>{lesson.title}</span>
        {prog && (
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusDot status={prog.status} />
            <span className="text-[10px]" style={{ color: prog.status === "error" ? "#ef4444" : prog.status === "done" ? "#2dd4a0" : "var(--text-muted)" }}>
              {prog.message}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: "#0cc0df" }}>Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Link href="/courses" className="hover:underline" style={{ color: "#0cc0df" }}>Courses</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <Link href={`/courses/${courseId}`} className="hover:underline" style={{ color: "#0cc0df" }}>{course?.title}</Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Batch Slides</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Batch Slides</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          AI fill and generate Google Slides for multiple lessons at once.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lesson selection */}
        <div className="lg:col-span-2 rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className={sectionHeading}>Select Lessons</p>
            <div className="flex gap-3">
              <button onClick={selectAll} disabled={running} className="text-xs hover:underline" style={{ color: "#0cc0df" }}>Select all</button>
              <button onClick={selectNone} disabled={running} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>None</button>
            </div>
          </div>

          {lessons.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No lessons in this course yet.</p>
          ) : (
            <div className="space-y-4">
              {modules.map(mod => {
                const modLessons = lessons.filter(l => mod.lessonIds.includes(l.id));
                if (modLessons.length === 0) return null;
                const allSelected = modLessons.every(l => selectedIds.has(l.id));
                return (
                  <div key={mod.id}>
                    <button
                      onClick={() => toggleModule(mod.lessonIds)}
                      disabled={running}
                      className="flex items-center gap-2 mb-1 w-full text-left"
                    >
                      <input type="checkbox" checked={allSelected} onChange={() => {}} className="accent-[#0cc0df] w-3.5 h-3.5 pointer-events-none" />
                      <span className="text-xs font-semibold" style={{ color: "#0cc0df" }}>{mod.title}</span>
                    </button>
                    <div className="ml-2 space-y-0.5">
                      {modLessons.map(renderLessonRow)}
                    </div>
                  </div>
                );
              })}

              {unassigned.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1 ml-1" style={{ color: "var(--text-muted)" }}>Unassigned</p>
                  <div className="space-y-0.5">
                    {unassigned.map(renderLessonRow)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Options + Run */}
        <div className="space-y-4">
          <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className={sectionHeading}>Options</p>

            <label className={`flex items-center gap-2.5 ${hasAiKey ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <input type="checkbox" checked={doAiFill} onChange={e => setDoAiFill(e.target.checked)} disabled={running || !hasAiKey} className="accent-[#0cc0df] w-3.5 h-3.5" />
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>AI Fill Content</span>
            </label>
            {!hasAiKey && (
              <p className="text-xs ml-6" style={{ color: "var(--text-muted)" }}>
                No API key configured. Add one in{" "}
                <Link href="/profile" className="underline" style={{ color: "#0cc0df" }}>Profile</Link>.
              </p>
            )}
            {doAiFill && (
              <div className="ml-6">
                <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Slides per lesson</label>
                <input
                  type="number" min={1} max={20} value={slideCount}
                  onChange={e => setSlideCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                  disabled={running}
                  className={`w-24 ${inputClass}`} style={inputStyle}
                />
              </div>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={doGenerate} onChange={e => setDoGenerate(e.target.checked)} disabled={running} className="accent-[#0cc0df] w-3.5 h-3.5" />
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Generate Google Slides</span>
            </label>

            <div className="pt-2">
              <button
                onClick={handleRun}
                disabled={!canRun}
                className="w-full rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition shadow"
              >
                {running ? "Running…" : `Run on ${totalSelected} lesson${totalSelected !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          {/* Progress summary */}
          {(running || finished) && (
            <div className="rounded-3xl p-5 space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className={sectionHeading}>Progress</p>
              {running && (
                <p className="text-xs" style={{ color: "#0cc0df" }}>
                  {doneCount + errorCount} of {totalSelected} complete…
                </p>
              )}
              {finished && (
                <p className="text-xs font-semibold" style={{ color: errorCount > 0 ? "#ef4444" : "#2dd4a0" }}>
                  {doneCount} succeeded{errorCount > 0 ? `, ${errorCount} failed` : " — all done!"}
                </p>
              )}
              {finished && doneCount > 0 && (
                <Link href={`/courses/${courseId}`} className="block text-xs hover:underline mt-1" style={{ color: "#0cc0df" }}>
                  ← Back to course
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
