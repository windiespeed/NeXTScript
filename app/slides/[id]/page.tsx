"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import LessonForm from "@/components/LessonForm";
import type { Lesson, LessonInput } from "@/types/lesson";
import type { Course, CourseModule } from "@/types/course";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

export default function EditSlidesPage() {
  useSession({ required: true });
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAiKey, setHasAiKey] = useState(false);
  // Assignment state
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/lessons/${id}`).then(r => r.json()),
      fetch("/api/user/settings").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]).then(([lessonData, settings, coursesData]) => {
      setLesson(lessonData);
      setHasAiKey(settings.hasKey ?? false);
      const courseList: Course[] = Array.isArray(coursesData) ? coursesData : [];
      setCourses(courseList);

      if (lessonData?.courseId) {
        setSelectedCourseId(lessonData.courseId);
        const course = courseList.find(c => c.id === lessonData.courseId);
        const mods: CourseModule[] = Array.isArray(course?.modules) ? course.modules : [];
        setModules(mods);
        // Find which module this lesson is in
        const currentMod = mods.find(m => m.lessonIds.includes(id));
        if (currentMod) setSelectedModuleId(currentMod.id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Update modules when course selection changes
  useEffect(() => {
    if (!courses.length) return;
    const course = courses.find(c => c.id === selectedCourseId);
    const mods: CourseModule[] = Array.isArray(course?.modules) ? course.modules : [];
    setModules(mods);
    // Only reset module if the course actually changed from the lesson's original
    if (selectedCourseId !== lesson?.courseId) {
      setSelectedModuleId("");
    }
  }, [selectedCourseId, courses, lesson?.courseId]);

  async function saveAssignment() {
    if (!lesson) return;
    setSavingAssignment(true);

    // Update lesson courseId if changed
    if (selectedCourseId !== (lesson.courseId ?? "")) {
      await fetch(`/api/lessons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourseId || null }),
      }).catch(() => {});

      // Remove from old course
      if (lesson.courseId) {
        const oldCourse = courses.find(c => c.id === lesson.courseId);
        if (oldCourse) {
          const updatedModules = (oldCourse.modules ?? []).map(m => ({
            ...m,
            lessonIds: m.lessonIds.filter(lid => lid !== id),
          }));
          await fetch(`/api/courses/${lesson.courseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modules: updatedModules }),
          }).catch(() => {});
        }
      }

      setLesson(prev => prev ? { ...prev, courseId: selectedCourseId || undefined } : prev);
    }

    // Update module assignment on the new/current course
    if (selectedCourseId) {
      const course = courses.find(c => c.id === selectedCourseId);
      if (course) {
        const updatedModules = (course.modules ?? []).map(m => ({
          ...m,
          lessonIds: m.id === selectedModuleId
            ? m.lessonIds.includes(id) ? m.lessonIds : [...m.lessonIds, id]
            : m.lessonIds.filter(lid => lid !== id),
        }));
        await fetch(`/api/courses/${selectedCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modules: updatedModules }),
        }).catch(() => {});
        // Refresh local modules
        setCourses(prev => prev.map(c => c.id === selectedCourseId ? { ...c, modules: updatedModules } : c));
        setModules(updatedModules);
      }
    }

    setSavingAssignment(false);
  }

  const backHref = lesson?.courseId ? `/lessons/${id}` : "/slides";

  async function putLesson(data: LessonInput) {
    const res = await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update lesson.");
    }
  }

  async function handleSubmit(data: LessonInput) {
    await putLesson(data);
    router.push(backHref);
    router.refresh();
  }

  async function handleAutoSave(data: LessonInput) {
    await putLesson(data);
  }

  if (loading) return <p className="text-sm text-[#0cc0df] mt-10">Loading…</p>;
  if (!lesson) return <p className="text-sm text-red-500 mt-10">Lesson not found.</p>;

  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const currentModule = modules.find(m => m.id === selectedModuleId);
  const assignmentChanged = selectedCourseId !== (lesson.courseId ?? "") ||
    selectedModuleId !== (modules.find(m => m.lessonIds.includes(id))?.id ?? "");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push(backHref)} className="text-sm text-[#0cc0df] hover:underline mb-2 block">
            ← {lesson.courseId ? "Back to Lesson" : "Back to Slides"}
          </button>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Edit Slides</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Edit content fields. Generate from the lesson hub.
          </p>
        </div>
      </div>

      {/* ── Assignment ── */}
      <div className={cardClass} style={cardStyle}>
        <p className={sectionLabel}>Assignment</p>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Course</label>
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— No course —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        {selectedCourseId && modules.length > 0 && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Module <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
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

        {(selectedCourse || currentModule) && (
          <div className="flex flex-wrap gap-1.5">
            {selectedCourse && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                {selectedCourse.title}
              </span>
            )}
            {currentModule && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
                {currentModule.title}
              </span>
            )}
          </div>
        )}

        {assignmentChanged && (
          <button
            onClick={saveAssignment}
            disabled={savingAssignment}
            className="rounded-full bg-[#0cc0df] px-4 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingAssignment ? "Saving…" : "Save Assignment"}
          </button>
        )}
      </div>

      <LessonForm
        initial={lesson}
        onSubmit={handleSubmit}
        autoSave={handleAutoSave}
        onCancel={() => router.push(backHref)}
        submitLabel="Save Changes"
        hasAiKey={hasAiKey}
        isEditing
      />
    </div>
  );
}
