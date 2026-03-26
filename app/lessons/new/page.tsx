"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Course, CourseModule } from "@/types/course";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

const LESSON_TYPES = [
  { value: "lesson",     label: "Lesson" },
  { value: "practice",  label: "Practice" },
  { value: "project",   label: "Project" },
  { value: "assessment",label: "Assessment" },
  { value: "review",    label: "Review" },
] as const;

function NewLessonInner() {
  useSession({ required: true });
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("courseId") ?? "";

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [lessonType, setLessonType] = useState<string>("lesson");
  const [topics, setTopics] = useState("");
  const [deadline, setDeadline] = useState("");

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseIdParam);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/courses").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCourses(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const course = courses.find(c => c.id === selectedCourseId);
    setModules(Array.isArray(course?.modules) ? course.modules : []);
    setSelectedModuleId("");
  }, [selectedCourseId, courses]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!selectedCourseId) { setError("Please assign this lesson to a course."); return; }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim(),
          lessonType,
          topics: topics.trim(),
          deadline: deadline.trim(),
          courseId: selectedCourseId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create lesson.");
      }
      const lesson = await res.json();

      // Assign to module if selected
      if (selectedCourseId && selectedModuleId) {
        const course = courses.find(c => c.id === selectedCourseId);
        if (course) {
          const updatedModules = (course.modules ?? []).map(m => ({
            ...m,
            lessonIds: m.id === selectedModuleId
              ? m.lessonIds.includes(lesson.id) ? m.lessonIds : [...m.lessonIds, lesson.id]
              : m.lessonIds,
          }));
          await fetch(`/api/courses/${selectedCourseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modules: updatedModules }),
          }).catch(() => {});
        }
      }

      router.push(`/lessons/${lesson.id}`);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  }

  const backHref = selectedCourseId ? `/courses/${selectedCourseId}` : "/courses";

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <button onClick={() => router.push(backHref)} className="text-sm text-[#0cc0df] hover:underline mb-2 block">
          ← {selectedCourseId ? "Back to Course" : "Back to Courses"}
        </button>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>New Lesson</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Create a lesson hub. Add slides, quizzes, and resources after.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        {/* Assignment */}
        <div className={cardClass} style={cardStyle}>
          <p className={sectionLabel}>Assignment</p>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Course <span className="text-red-500">*</span></label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">— Select a course —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          {selectedCourseId && modules.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Module <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span></label>
              <select
                value={selectedModuleId}
                onChange={e => setSelectedModuleId(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">— No module —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Lesson Info */}
        <div className={cardClass} style={cardStyle}>
          <p className={sectionLabel}>Lesson Info</p>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Variables"
              className={inputClass}
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subtitle <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span></label>
            <input
              type="text"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="e.g. Understanding data types and variable declaration"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Type</label>
              <select
                value={lessonType}
                onChange={e => setLessonType(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                {LESSON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Deadline <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span></label>
              <input
                type="text"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                placeholder="e.g. 2026-04-01"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Topics <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span></label>
            <input
              type="text"
              value={topics}
              onChange={e => setTopics(e.target.value)}
              placeholder="e.g. Variables, Data Types, Type Casting"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={creating || !title.trim() || !selectedCourseId}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition shadow"
          >
            {creating ? "Creating…" : "Create Lesson"}
          </button>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="rounded-full px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-card-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewLessonPage() {
  return (
    <Suspense>
      <NewLessonInner />
    </Suspense>
  );
}
