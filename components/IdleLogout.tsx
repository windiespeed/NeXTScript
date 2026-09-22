"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";

// Auto-logout after this long with no mouse/keyboard/touch activity — warn the user
// WARNING_MS before it actually happens so they get a chance to stay signed in instead of
// losing whatever they were doing. Form drafts are autosaved to localStorage independently
// (lib/draftStorage.ts) so a surprise logout doesn't lose in-progress work either way, but a
// warning is friendlier than a silent redirect mid-task.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const POLL_MS = 5000;

// Shared across tabs (same origin) so activity in one tab keeps every other tab signed in too —
// without this, an idle background tab could sign out the session out from under an active one.
const LAST_ACTIVITY_KEY = "nextscript:lastActivity";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "wheel", "touchstart", "scroll"] as const;

function readLastActivity(): number {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : Date.now();
}

function writeLastActivity(t: number) {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(t));
}

export default function IdleLogout() {
  const { status } = useSession();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    writeLastActivity(Date.now());
    let lastWrite = Date.now();

    function onActivity() {
      const now = Date.now();
      // Throttle localStorage writes — a raw mousemove/scroll stream would otherwise write on
      // nearly every frame. A few seconds of slop against a 30-minute timeout is negligible.
      if (now - lastWrite > 3000) {
        writeLastActivity(now);
        lastWrite = now;
      }
      setSecondsLeft(null);
    }

    function onStorage(e: StorageEvent) {
      if (e.key === LAST_ACTIVITY_KEY) setSecondsLeft(null);
    }

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);

    const interval = setInterval(() => {
      if (loggingOutRef.current) return;
      const idleFor = Date.now() - readLastActivity();
      if (idleFor >= IDLE_TIMEOUT_MS) {
        loggingOutRef.current = true;
        signOut({ callbackUrl: "/" });
      } else if (idleFor >= IDLE_TIMEOUT_MS - WARNING_MS) {
        setSecondsLeft(Math.ceil((IDLE_TIMEOUT_MS - idleFor) / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, POLL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, onActivity));
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [status]);

  function stayLoggedIn() {
    writeLastActivity(Date.now());
    setSecondsLeft(null);
  }

  if (secondsLeft === null) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-9999 w-80 rounded-2xl shadow-lg p-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      role="alertdialog"
      aria-live="assertive"
    >
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>You&apos;ve been inactive</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
        You&apos;ll be signed out in {secondsLeft}s due to inactivity.
      </p>
      <button
        onClick={stayLoggedIn}
        className="mt-3 w-full rounded-full bg-[#0cc0df] px-3 py-1.5 text-xs font-semibold text-[#0a0b13] hover:opacity-90 transition"
      >
        Stay signed in
      </button>
    </div>
  );
}
