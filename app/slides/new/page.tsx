"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import LessonForm from "@/components/LessonForm";
import type { LessonInput } from "@/types/lesson";
import type { Course, CourseModule } from "@/types/course";

const inputClass = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputStyle = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardClass = "rounded-3xl p-5 space-y-4";
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" };
const sectionLabel = "text-xs font-semibold uppercase tracking-widest text-[#0cc0df]";

function NewSlidesInner() {
  useSession({ required: true });
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("courseId") ?? "";

  const [hasAiKey, setHasAiKey] = useState(false);
  const [defaultSources, setDefaultSources] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Assignment state
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseIdParam);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");

  const backHref = selectedCourseId ? `/courses/${selectedCourseId}` : "/slides";

  useEffect(() => {
    Promise.all([
      fetch("/api/user/settings").then(r => r.json()),
      fetch("/api/courses").then(r => r.json()),
    ]).then(([userSettings, coursesData]) => {
      setHasAiKey(userSettings.hasKey ?? false);
      const courseList: Course[] = Array.isArray(coursesData) ? coursesData : [];
      setCourses(courseList);

      // Load default sources from the selected course or user settings
      const course = courseList.find(c => c.id === courseIdParam);
      if (course?.settings?.defaultSources) {
        setDefaultSources(course.settings.defaultSources);
      } else {
        setDefaultSources(userSettings.defaultSources ?? "");
      }
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, [courseIdParam]);

  // Update modules when course changes
  useEffect(() => {
    const course = courses.find(c => c.id === selectedCourseId);
    setModules(Array.isArray(course?.modules) ? course.modules : []);
    setSelectedModuleId("");
    // Update default sources when course changes after initial load
    if (settingsLoaded) {
      if (course?.settings?.defaultSources) {
        setDefaultSources(course.settings.defaultSources);
      }
    }
  }, [selectedCourseId, courses, settingsLoaded]);

  async function postLesson(data: LessonInput): Promise<string> {
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, courseId: selectedCourseId || undefined }),
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

    return lesson.id as string;
  }

  async function handleSaveDraft(data: LessonInput) {
    const id = await postLesson(data);
    router.replace(`/slides/${id}`);
  }

  async function handleSubmit(data: LessonInput) {
    const id = await postLesson(data);
    router.push(`/lessons/${id}`);
  }

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push(backHref)} className="text-sm text-[#0cc0df] hover:underline mb-2 block">
            ← {selectedCourseId ? "Back to Course" : "Back to Slides"}
          </button>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>New Slides</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Add content for AI generation. Generate from the lesson hub.
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

        {selectedCourse && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              {selectedCourse.title}
            </span>
            {selectedModuleId && modules.find(m => m.id === selectedModuleId) && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
                {modules.find(m => m.id === selectedModuleId)!.title}
              </span>
            )}
          </div>
        )}
      </div>

      {settingsLoaded && (
        <LessonForm
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
          onCancel={() => router.push(backHref)}
          submitLabel="Save & View Lesson"
          hasAiKey={hasAiKey}
          initial={{ sources: defaultSources, ...(selectedCourseId ? { courseId: selectedCourseId } : {}) }}
        />
      )}
    </div>
  );
}

export default function NewSlidesPage() {
  return (
    <Suspense>
      <NewSlidesInner />
    </Suspense>
  );
}
