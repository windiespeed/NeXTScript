"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?")[0].toUpperCase();
}

export default function Nav() {
  const { data: session, status } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/user/settings")
        .then((r) => r.json())
        .then((data) => setAvatarUrl(data.avatarUrl ?? null))
        .catch(() => {});
    }
  }, [session?.user?.email]);

  const displaySrc = avatarUrl ?? session?.user?.image ?? null;
  const userInitials = initials(session?.user?.name, session?.user?.email);

  return (
    <nav className="bg-[#0d1c35] shadow-md">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="NeXTScript" width={160} height={44} className="h-15 w-auto brightness-0 invert" priority />
        </Link>

        <div className="flex items-center gap-4">
{status === "loading" ? null : session ? (
            <Link
              href="/profile"
              className="flex items-center gap-2 group"
              aria-label="Profile"
            >
              <span className="text-xs text-gray-400 group-hover:text-white transition hidden sm:block max-w-[140px] truncate">
                {session.user?.email}
              </span>
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-[#0cc0df] transition-all flex-shrink-0">
                {displaySrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displaySrc} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1e4a85] flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{userInitials}</span>
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition-all duration-150 shadow"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
