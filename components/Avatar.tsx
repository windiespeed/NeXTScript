"use client";

import { useState } from "react";

/** Event the profile page fires after the uploaded photo changes, so the top bar can refresh. */
export const AVATAR_CHANGED_EVENT = "nextscript:avatar-changed";

export function initials(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

interface AvatarProps {
  /** Image URLs in order of preference; empty entries are skipped. */
  sources: (string | null | undefined)[];
  name?: string | null;
  email?: string | null;
  alt?: string;
  /** Classes for the initials shown when no image loads. */
  initialsClassName?: string;
  initialsStyle?: React.CSSProperties;
}

/**
 * Shows the first image that loads, falling back to the user's initials.
 * Google profile photos (lh3.googleusercontent.com) can refuse requests that carry
 * a Referer, and the URL saved at sign-in can go stale, so a failed load moves on
 * to the next source instead of leaving a broken-image icon.
 */
export default function Avatar({ sources, name, email, alt = "", initialsClassName, initialsStyle }: AvatarProps) {
  const list = sources.filter((s): s is string => !!s);
  const key = list.join("\n");
  const [failed, setFailed] = useState<{ key: string; count: number }>({ key, count: 0 });
  const failedCount = failed.key === key ? failed.count : 0;
  const src = list[failedCount];

  if (!src) {
    return <span className={initialsClassName} style={initialsStyle}>{initials(name, email)}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover"
      onError={() => setFailed({ key, count: failedCount + 1 })}
    />
  );
}
