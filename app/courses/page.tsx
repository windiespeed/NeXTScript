"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Course } from "@/types/course";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const MONTH_ORDER: Record<string, number> = {
  Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11
};

function termYear(term: string): number {
  const y = parseInt(term?.split(" ")[1] ?? "0", 10);
  return isNaN(y) ? 0 : y;
}

function termMonth(term: string): number {
  return MONTH_ORDER[term?.split(" ")[0]] ?? 0;
}

const gripSVG = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
  </svg>
);

function CourseCard({
  course,
  onDelete,
  onDuplicate,
  gripProps,
}: {
  course: Course;
  onDelete: (id: string) => void;
  onDuplicate: (course: Course) => void;
  gripProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div
      className="group relative h-full rounded-3xl flex flex-col hover:-translate-y-1 transition-all duration-200"
      style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold text-base leading-snug" style={{ color: "var(--text-primary)" }}>
            {course.title}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {course.settings?.studentLevel && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-[#0cc0df] capitalize" style={{ background: "var(--accent-bg)" }}>
                {course.settings.studentLevel}
              </span>
            )}
            {gripProps && (
              <div
                {...gripProps}
                title="Drag to reorder"
                className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
                style={{ color: "var(--text-muted)" }}
              >
                {gripSVG}
              </div>
            )}
            <button
              onClick={() => onDuplicate(course)}
              title="Duplicate course"
              className="p-1.5 rounded-full transition opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>

        {course.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {course.description}
          </p>
        )}

        {(course.settings?.subject || course.gradeLevel || course.term) && (
          <div className="flex flex-wrap gap-1.5">
            {course.settings?.subject && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
                {course.settings.subject}
              </span>
            )}
            {course.gradeLevel && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
                {course.gradeLevel}
              </span>
            )}
            {course.term && (
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}>
                {course.term}{course.semester ? ` · ${course.semester}` : ""}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--accent-purple)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            {course.lessonIds.length} {course.lessonIds.length === 1 ? "lesson" : "lessons"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{fmt(course.createdAt)}</span>
        </div>
      </div>

      <div className="flex gap-2 px-5 pb-5">
        <Link
          href={`/courses/${course.id}`}
          className="flex-1 flex items-center justify-center rounded-full bg-[#0cc0df] py-2 text-xs font-semibold text-[#0a0b13] hover:opacity-90 active:scale-95 transition-all"
        >
          Open
        </Link>
        <Link
          href={`/courses/${course.id}/settings`}
          title="Course settings"
          className="p-2 rounded-full transition hover:bg-[var(--bg-card-hover)] active:scale-95"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </Link>
        <button
          onClick={() => onDelete(course.id)}
          title="Delete course"
          className="p-2 rounded-full transition hover:bg-red-500/10 hover:text-red-500 active:scale-95"
          style={{ color: "var(--text-muted)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  );
}

function SortableCourseCard({ course, onDelete, onDuplicate }: { course: Course; onDelete: (id: string) => void; onDuplicate: (course: Course) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <CourseCard
        course={course}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        gripProps={{ ...listeners, ...attributes } as React.HTMLAttributes<HTMLDivElement>}
      />
    </div>
  );
}

export default function CoursesPage() {
  useSession({ required: true });
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseOrder, setCourseOrder] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    try {
      const sc = localStorage.getItem("sort-courses");
      if (sc) setCourseOrder(JSON.parse(sc));
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/courses").then(r => r.json()).then(data => {
      setCourses(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this course? This will not delete its lessons.")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE" });
    setCourses(prev => prev.filter(c => c.id !== id));
  }

  async function handleDuplicate(course: Course) {
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Copy of ${course.title}`,
        description: course.description,
        gradeLevel: course.gradeLevel,
        term: course.term,
        semester: course.semester,
        settings: course.settings,
        lessonIds: [],
      }),
    });
    if (res.ok) {
      const copy = await res.json();
      setCourses(prev => [copy, ...prev]);
    }
  }

  const sortedCourses: Course[] = (() => {
    const orderedIds = courseOrder.filter(id => courses.some(c => c.id === id));
    const unordered = courses.filter(c => !courseOrder.includes(c.id));
    const ordered = orderedIds.map(id => courses.find(c => c.id === id)!);
    return [...ordered, ...unordered];
  })();

  function handleCourseDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedCourses.findIndex(c => c.id === active.id);
    const newIndex = sortedCourses.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newSorted = arrayMove(sortedCourses, oldIndex, newIndex);
    const newOrder = newSorted.map(c => c.id);
    setCourseOrder(newOrder);
    localStorage.setItem("sort-courses", JSON.stringify(newOrder));
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Curriculum</p>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Courses</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Organize lessons into courses with independent settings.</p>
          </div>
          <Link href="/courses/new" className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition shadow">
            + New Course
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[#0cc0df]">Loading…</p>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-12 h-12 rounded-3xl bg-[#0cc0df]/10 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0cc0df" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No courses yet</p>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Create a course to organize lessons with shared settings.</p>
            <Link href="/courses/new" className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
              Create your first course
            </Link>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCourseDragEnd}>
            <SortableContext items={sortedCourses.map(c => c.id)} strategy={rectSortingStrategy}>
              {(() => {
                const grouped = new Map<number, Course[]>();
                for (const c of sortedCourses) {
                  const y = termYear(c.term);
                  if (!grouped.has(y)) grouped.set(y, []);
                  grouped.get(y)!.push(c);
                }
                const years = Array.from(grouped.keys()).sort((a, b) => b - a);
                return years.map((year, yi) => {
                  const group = grouped.get(year)!.slice().sort((a, b) => termMonth(b.term) - termMonth(a.term));
                  return (
                    <div key={year} className={yi > 0 ? "mt-8" : ""}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                          {year === 0 ? "No Term" : year}
                        </span>
                        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {group.map(course => (
                          <SortableCourseCard key={course.id} course={course} onDelete={handleDelete} onDuplicate={handleDuplicate} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
