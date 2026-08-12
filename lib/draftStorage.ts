interface DraftEnvelope<T> {
  v: 1;
  savedAt: number;
  data: T;
}

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function storageKey(key: string): string {
  return `nextscript:draft:${key}`;
}

export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: DraftEnvelope<T> = { v: 1, savedAt: Date.now(), data };
    window.localStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch {
    // localStorage full or unavailable (private browsing) — draft persistence is best-effort
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}
