"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Nav() {
  const { data: session, status } = useSession();

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-blue-900 text-lg tracking-tight">
          NeXTScript
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/lessons/new"
            className="rounded-md bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 transition"
          >
            + New Lesson
          </Link>

          {status === "loading" ? null : session ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 hidden sm:block">{session.user?.email}</span>
              <button
                onClick={() => signOut()}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
