import type { Course } from "@/types/course";
import type { UserSettings } from "@/lib/userSettings";

/** What the course teaches, as the AI prompts describe it. Empty strings when unset. */
export interface ProgramContext {
  industry: string;
  subject: string;
}

/**
 * The course's Industry and Subject Area, falling back to the user's Profile values (course wins).
 * Every AI generator uses this so a deck, a lesson and a quiz for the same course are framed the
 * same way, whatever the subject.
 */
export function resolveProgramContext(course: Course | undefined | null, settings: Pick<UserSettings, "industry" | "subject">): ProgramContext {
  return {
    industry: (course?.settings?.industry || settings.industry || "").trim(),
    subject: (course?.settings?.subject || settings.subject || "").trim(),
  };
}

/** "Healthcare — Nursing 101", or null when neither is set. */
export function describeProgram(ctx: Partial<ProgramContext> | undefined): string | null {
  const parts = [ctx?.industry, ctx?.subject].map(s => s?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}
