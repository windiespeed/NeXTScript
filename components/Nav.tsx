"use client";

import Link from "next/link";
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
    <nav className="border-b border-gray-600 dark:border-gray-300 bg-gray-700 dark:bg-gray-200 shadow-sm">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-white dark:text-blue-800 text-lg tracking-tight">
          NeXTScript
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="rounded-md border border-gray-500 dark:border-gray-400 px-3 py-1.5 text-sm text-gray-300 dark:text-gray-600 hover:bg-gray-600 dark:hover:bg-gray-300 active:scale-95 transition-all duration-150"
            aria-label="Toggle theme"
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>

          {status === "loading" ? null : session ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300 dark:text-gray-600 hidden sm:block">{session.user?.email}</span>
              <button
                onClick={() => signOut()}
                className="text-xs text-gray-300 dark:text-gray-600 hover:text-white dark:hover:text-gray-900 underline active:scale-95 transition-all duration-150"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md border border-gray-500 dark:border-gray-400 px-3 py-1.5 text-sm font-medium text-gray-200 dark:text-gray-700 hover:bg-gray-600 dark:hover:bg-gray-300 active:scale-95 transition-all duration-150"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
