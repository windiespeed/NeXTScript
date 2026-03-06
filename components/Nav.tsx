"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function Nav() {
  const { data: session, status } = useSession();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <nav className="bg-[#112543] shadow-md">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="NeXTScript" width={160} height={44} className="h-15 w-auto brightness-0 invert" priority />
        </Link>

        <div className="flex items-center gap-4">
          {session && (
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <Link href="/" className="text-[#0cc0df] hover:text-white transition font-medium">
                Lessons
              </Link>
              <Link href="/slides/new" className="text-[#0cc0df] hover:text-white transition font-medium">
                Slides
              </Link>
              <Link href="/forms/new" className="text-[#0cc0df] hover:text-white transition font-medium">
                Forms
              </Link>
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="rounded-md border border-[#1e4a85] px-3 py-1.5 text-xs text-[#0cc0df] hover:bg-[#1e4a85] active:scale-95 transition-all duration-150"
            aria-label="Toggle theme"
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>

          {status === "loading" ? null : session ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:block">{session.user?.email}</span>
              <button
                onClick={() => signOut()}
                className="text-xs text-gray-400 hover:text-white underline active:scale-95 transition-all duration-150"
              >
                Sign out
              </button>
            </div>
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
