"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Lesson } from "@/types/lesson";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_COLOR: Record<Lesson["status"], string> = {
  draft:        "bg-[var(--text-muted)]",
  generating:   "bg-[#ff8c4a]",
  regenerating: "bg-[#0cc0df]",
  done:         "bg-[#2dd4a0]",
  error:        "bg-red-500",
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function SchedulePage() {
  useSession({ required: true });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [view, setView] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    fetch("/api/lessons").then((r) => r.json()).then((data) => {
      setLessons(Array.isArray(data) ? data.filter((l: Lesson) => l.deadline) : []);
      setLoading(false);
    });
  }, []);

  const deadlineMap = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    if (!lesson.deadline) continue;
    if (!deadlineMap.has(lesson.deadline)) deadlineMap.set(lesson.deadline, []);
    deadlineMap.get(lesson.deadline)!.push(lesson);
  }

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() { setView(new Date(year, month - 1, 1)); setSelectedDay(null); }
  function nextMonth() { setView(new Date(year, month + 1, 1)); setSelectedDay(null); }
  function goToday()   { setView(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); }

  function dayKey(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const selectedLessons = selectedDay
    ? (deadlineMap.get(`${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, "0")}-${String(selectedDay.getDate()).padStart(2, "0")}`) ?? [])
    : [];

  const upcomingAll = lessons
    .filter((l) => parseLocalDate(l.deadline) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Planning</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Schedule</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Lesson deadlines across all courses.</p>
        </div>
        {!loading && (
          <span className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {lessons.length} {lessons.length === 1 ? "deadline" : "deadlines"}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#0cc0df]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendar */}
          <div className="lg:col-span-2 rounded-3xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-5">
              <button onClick={prevMonth} className="p-2 rounded-full transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-secondary)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{MONTHS[month]} {year}</h2>
                <button onClick={goToday} className="text-xs px-2.5 py-1 rounded-full font-semibold text-[#0cc0df] transition hover:bg-[#0cc0df]/10">Today</button>
              </div>
              <button onClick={nextMonth} className="p-2 rounded-full transition hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-secondary)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const key = dayKey(day);
                const cellDate = new Date(year, month, day);
                const isToday = isSameDay(cellDate, today);
                const isSelected = selectedDay ? isSameDay(cellDate, selectedDay) : false;
                const count = deadlineMap.get(key)?.length ?? 0;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(isSelected ? null : cellDate)}
                    className={`relative rounded-full p-1.5 text-xs font-semibold text-center transition-all flex flex-col items-center gap-0.5 min-h-[44px]
                      ${isSelected ? "bg-[#0cc0df] text-[#0a0b13]" : isToday ? "bg-[#0cc0df]/15 text-[#0cc0df]" : "hover:bg-[var(--bg-card-hover)]"}`}
                    style={!isSelected && !isToday ? { color: "var(--text-primary)" } : {}}
                  >
                    <span>{day}</span>
                    {count > 0 && (
                      <div className="flex gap-0.5 flex-wrap justify-center">
                        {Array.from({ length: Math.min(count, 3) }).map((_, idx) => (
                          <span key={idx} className={`w-1 h-1 rounded-full ${isSelected ? "bg-[#0a0b13]/50" : "bg-[#ff8c4a]"}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {selectedDay && (
              <div className="rounded-3xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-accent, var(--border))" }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--sidebar-label)" }}>
                  {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </p>
                {selectedLessons.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No lessons due.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedLessons.map((lesson) => (
                      <Link key={lesson.id} href={`/lessons/${lesson.id}`}
                        className="flex items-center gap-3 rounded-full px-3 py-2.5 transition hover:bg-[var(--bg-card-hover)] group"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[lesson.status]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate group-hover:text-[#0cc0df] transition" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                          {lesson.tag && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{lesson.tag}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-3xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--sidebar-label)" }}>Upcoming</p>
              {upcomingAll.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No upcoming deadlines.</p>
              ) : (
                <div className="space-y-1.5">
                  {upcomingAll.slice(0, 10).map((lesson) => {
                    const d = parseLocalDate(lesson.deadline);
                    const isOverdue = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    return (
                      <Link key={lesson.id} href={`/lessons/${lesson.id}`}
                        className="flex items-center gap-3 rounded-full px-2.5 py-2 transition hover:bg-[var(--bg-card-hover)] group"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-[#ff8c4a]"}`} />
                        <p className="flex-1 text-xs font-semibold truncate group-hover:text-[#0cc0df] transition" style={{ color: "var(--text-primary)" }}>{lesson.title}</p>
                        <span className={`text-[10px] font-semibold shrink-0 ${isOverdue ? "text-red-500" : ""}`} style={!isOverdue ? { color: "var(--text-muted)" } : {}}>
                          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </Link>
                    );
                  })}
                  {upcomingAll.length > 10 && <p className="text-xs text-center pt-1" style={{ color: "var(--text-muted)" }}>+{upcomingAll.length - 10} more</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
