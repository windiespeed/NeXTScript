"use client";

import { useEffect } from "react";
import { loadDraft, saveDraft } from "@/lib/draftStorage";

export function useDraftAutosave<T>(key: string | null, data: T, enabled = true, debounceMs = 500): void {
  useEffect(() => {
    if (!enabled || !key) return;
    const timer = setTimeout(() => saveDraft(key, data), debounceMs);
    return () => clearTimeout(timer);
  }, [key, data, enabled, debounceMs]);
}

export function useDraftRestore<T>(key: string | null, onRestore: (data: T) => void): void {
  useEffect(() => {
    if (!key) return;
    const draft = loadDraft<T>(key);
    if (draft) onRestore(draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
