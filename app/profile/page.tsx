"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?")[0].toUpperCase();
}

function resizeToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 200;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image.")); };
    img.src = url;
  });
}

export default function ProfilePage() {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Theme
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

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  // Default sources
  const [defaultSources, setDefaultSources] = useState("");
  const [savingSources, setSavingSources] = useState(false);

  // API key
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        setHasKey(data.hasKey);
        setMaskedKey(data.maskedKey);
        setAvatarUrl(data.avatarUrl ?? null);
        setDefaultSources(data.defaultSources ?? "");
      });
  }, []);

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setMessage(""); }
    else { setMessage(msg); setError(""); }
  }

  // ── Avatar ────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    flash("");
    try {
      const base64 = await resizeToBase64(file);
      const res = await fetch("/api/user/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: base64 }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setAvatarUrl(base64);
      flash("Profile photo updated.");
    } catch (err: any) {
      flash(err.message || "Upload failed.", true);
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (!confirm("Remove your profile photo?")) return;
    setRemovingAvatar(true);
    flash("");
    await fetch("/api/user/avatar", { method: "DELETE" });
    setAvatarUrl(null);
    setRemovingAvatar(false);
    flash("Profile photo removed.");
  }

  // ── Default sources ───────────────────────────────────────────────────
  async function handleSaveSources(e: React.FormEvent) {
    e.preventDefault();
    setSavingSources(true);
    flash("");
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultSources }),
    });
    setSavingSources(false);
    if (res.ok) flash("Default sources saved.");
    else { const d = await res.json(); flash(d.error || "Failed to save.", true); }
  }

  // ── API key ───────────────────────────────────────────────────────────
  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setSavingKey(true);
    flash("");
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anthropicKey: keyInput.trim() }),
    });
    setSavingKey(false);
    if (res.ok) {
      const k = keyInput.trim();
      setHasKey(true);
      setMaskedKey(`${k.slice(0, 12)}…${k.slice(-4)}`);
      setKeyInput("");
      flash("API key saved.");
    } else {
      const d = await res.json();
      flash(d.error || "Failed to save.", true);
    }
  }

  async function handleRemoveKey() {
    if (!confirm("Remove your Anthropic API key? AI fill will be disabled.")) return;
    setRemovingKey(true);
    flash("");
    await fetch("/api/user/settings", { method: "DELETE" });
    setRemovingKey(false);
    setHasKey(false);
    setMaskedKey(null);
    flash("API key removed.");
  }

  if (status === "loading") return null;

  const displayAvatar = avatarUrl ?? session?.user?.image ?? null;
  const userInitials = initials(session?.user?.name, session?.user?.email);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <button onClick={() => router.push("/")} className="text-sm text-[#0cc0df] hover:underline mb-4 block">
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-black dark:text-white">Profile</h1>
      </div>

      {/* ── User info card ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e4a85]/30 bg-white dark:bg-[#112543] p-6">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="group relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#0cc0df] focus:ring-offset-2"
              aria-label="Upload profile photo"
            >
              {displayAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#1e4a85] flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{userInitials}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-disabled:opacity-0 transition-opacity rounded-full">
                <span className="text-white text-xs font-semibold">{uploadingAvatar ? "…" : "Edit"}</span>
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Name + email */}
          <div className="flex-1 min-w-0">
            {session?.user?.name && (
              <p className="text-lg font-semibold text-[#0d1c35] dark:text-white truncate">{session.user.name}</p>
            )}
            <p className="text-sm text-gray-500 truncate">{session?.user?.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-xs text-[#0cc0df] hover:underline disabled:opacity-50"
              >
                {uploadingAvatar ? "Uploading…" : "Upload photo"}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={removingAvatar}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50"
                >
                  {removingAvatar ? "Removing…" : "Remove photo"}
                </button>
              )}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex-shrink-0 rounded-md border border-[#1e4a85] px-3 py-1.5 text-xs font-semibold text-[#0d1c35] dark:text-white hover:bg-[#1e4a85]/20 transition"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Status messages ────────────────────────────────────────────── */}
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ── Appearance ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e4a85]/30 bg-white dark:bg-[#112543] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0d1c35] dark:text-white">Appearance</h2>
            <p className="text-xs text-gray-500 mt-1">Choose your preferred color theme.</p>
          </div>
          <button
            onClick={toggleTheme}
            className="rounded-md border border-[#1e4a85] px-4 py-2 text-sm font-semibold text-[#0d1c35] dark:text-white hover:bg-[#1e4a85]/20 active:scale-95 transition-all duration-150 min-w-[100px]"
          >
            {dark ? "☀ Light mode" : "☾ Dark mode"}
          </button>
        </div>
      </div>

      {/* ── Default sources ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e4a85]/30 bg-white dark:bg-[#112543] p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#0d1c35] dark:text-white">Default Sources</h2>
          <p className="text-xs text-gray-500 mt-1">
            These URLs are pre-filled in the Sources field on every new lesson. Add one URL per line.
          </p>
        </div>
        <form onSubmit={handleSaveSources} className="space-y-3">
          <textarea
            value={defaultSources}
            onChange={(e) => setDefaultSources(e.target.value)}
            rows={5}
            placeholder={"https://www.w3schools.com/\nhttps://developer.mozilla.org/\nhttps://www.w3.org/"}
            className="w-full rounded-md border border-[#1e4a85]/30 dark:border-[#1e4a85]/50 bg-white dark:bg-[#0d1c35] px-3 py-2 text-sm font-mono text-[#0d1c35] dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
          <button
            type="submit"
            disabled={savingSources}
            className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingSources ? "Saving…" : "Save Sources"}
          </button>
        </form>
      </div>

      {/* ── Anthropic API key ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e4a85]/30 bg-white dark:bg-[#112543] p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-[#0d1c35] dark:text-white">Anthropic API Key</h2>
          <p className="text-xs text-gray-500 mt-1">
            Used for AI fill on your lessons. Each user provides their own key — you are only charged for your own usage.
          </p>
        </div>

        {hasKey && maskedKey && (
          <div className="flex items-center justify-between rounded-lg bg-[#f0f9ff] dark:bg-[#0d1c35] border border-[#1e4a85]/20 px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">Current key</p>
              <p className="text-sm font-mono text-[#0d1c35] dark:text-white">{maskedKey}</p>
            </div>
            <button
              onClick={handleRemoveKey}
              disabled={removingKey}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
            >
              {removingKey ? "Removing…" : "Remove"}
            </button>
          </div>
        )}

        <form onSubmit={handleSaveKey} className="space-y-3">
          <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white">
            {hasKey ? "Replace key" : "Add key"}
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-api03-…"
            className="w-full rounded-md border border-[#1e4a85]/30 dark:border-[#1e4a85]/50 bg-white dark:bg-[#0d1c35] px-3 py-2 text-sm font-mono text-[#0d1c35] dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
          <p className="text-xs text-gray-400">
            Get your key from{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[#0cc0df] hover:underline">
              console.anthropic.com
            </a>
          </p>
          <button
            type="submit"
            disabled={savingKey || !keyInput.trim()}
            className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingKey ? "Saving…" : "Save Key"}
          </button>
        </form>
      </div>
    </main>
  );
}
