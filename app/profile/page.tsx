"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/sectionLabels";
import { useTheme } from "@/context/Theme";

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

const inputCls = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0cc0df] transition placeholder:text-[var(--text-muted)]";
const inputSty = { background: "var(--bg-card-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };
const cardSty  = { background: "var(--bg-card)", border: "1px solid var(--border)" };

export default function ProfilePage() {
  const { data: session, status } = useSession({ required: true });
  const fileRef = useRef<HTMLInputElement>(null);

  const { dark, toggle: toggleTheme } = useTheme();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const [defaultSources, setDefaultSources] = useState("");
  const [savingSources, setSavingSources] = useState(false);

  const [industry, setIndustry] = useState("");
  const [subject, setSubject] = useState("");
  const [sectionLabels, setSectionLabels] = useState<SectionLabels>(DEFAULT_SECTION_LABELS);
  const [savingCurriculum, setSavingCurriculum] = useState(false);

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
        setIndustry(data.industry ?? "");
        setSubject(data.subject ?? "");
        if (data.sectionLabels) setSectionLabels({ ...DEFAULT_SECTION_LABELS, ...data.sectionLabels });
      });
  }, []);

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setMessage(""); }
    else { setMessage(msg); setError(""); }
  }

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

  async function handleSaveCurriculum(e: React.FormEvent) {
    e.preventDefault();
    setSavingCurriculum(true);
    flash("");
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry, subject, sectionLabels }),
    });
    setSavingCurriculum(false);
    if (res.ok) flash("Curriculum settings saved.");
    else { const d = await res.json(); flash(d.error || "Failed to save.", true); }
  }

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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Account</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Profile</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Manage your account and curriculum preferences.</p>
      </div>

      {/* User info card */}
      <div className="rounded-3xl p-6" style={cardSty}>
        <div className="flex items-center gap-6">
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
                <div className="w-full h-full bg-[#0cc0df]/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#0cc0df]">{userInitials}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-disabled:opacity-0 transition-opacity rounded-full">
                <span className="text-white text-xs font-semibold">{uploadingAvatar ? "…" : "Edit"}</span>
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex-1 min-w-0">
            {session?.user?.name && (
              <p className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{session.user.name}</p>
            )}
            <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{session?.user?.email}</p>
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

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--bg-card-hover)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Status messages */}
      {message && <p className="text-sm text-[#2dd4a0]">{message}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Appearance */}
      <div className="rounded-3xl p-6" style={cardSty}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Appearance</h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Choose your preferred color theme.</p>
          </div>
          <button
            onClick={toggleTheme}
            className="rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-[var(--bg-card-hover)] active:scale-95"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {dark ? "☀ Light mode" : "☾ Dark mode"}
          </button>
        </div>
      </div>

      {/* Default sources */}
      <div className="rounded-3xl p-6 space-y-4" style={cardSty}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Default Sources</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            These URLs are pre-filled in the Sources field on every new lesson. Add one URL per line.
          </p>
        </div>
        <form onSubmit={handleSaveSources} className="space-y-3">
          <textarea
            value={defaultSources}
            onChange={(e) => setDefaultSources(e.target.value)}
            rows={5}
            placeholder={"https://www.w3schools.com/\nhttps://developer.mozilla.org/\nhttps://www.w3.org/"}
            className={`${inputCls} font-mono`}
            style={inputSty}
          />
          <button
            type="submit"
            disabled={savingSources}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingSources ? "Saving…" : "Save Sources"}
          </button>
        </form>
      </div>

      {/* Curriculum settings */}
      <div className="rounded-3xl p-6 space-y-5" style={cardSty}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Curriculum Settings</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Customize your industry, subject area, and section labels. These are used by AI Fill and appear throughout your lessons and generated files.
          </p>
        </div>
        <form onSubmit={handleSaveCurriculum} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Industry</label>
              <input
                type="text"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Healthcare, Coding, Business"
                className={inputCls}
                style={inputSty}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subject Area</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. JavaScript, Nursing 101, Marketing"
                className={inputCls}
                style={inputSty}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Section Labels</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(DEFAULT_SECTION_LABELS) as (keyof SectionLabels)[]).map(key => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    {{
                      warmUp:                "Opening Activity",
                      guidedLab:             "Guided Activity",
                      selfPaced:             "Independent Activity",
                      submissionChecklist:   "Requirements Checklist",
                      checkpoint:            "Common Problems / FAQ",
                      industryBestPractices: "Best Practices",
                      devJournalPrompt:      "Reflection Journal",
                      rubric:                "Assessment / Rubric",
                    }[key]}
                  </label>
                  <input
                    type="text"
                    value={sectionLabels[key]}
                    onChange={e => setSectionLabels(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={DEFAULT_SECTION_LABELS[key]}
                    className={inputCls}
                    style={inputSty}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSectionLabels(DEFAULT_SECTION_LABELS)}
              className="mt-2 text-xs text-[#0cc0df] hover:underline"
            >
              Reset to defaults
            </button>
          </div>

          <button
            type="submit"
            disabled={savingCurriculum}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingCurriculum ? "Saving…" : "Save Curriculum Settings"}
          </button>
        </form>
      </div>

      {/* Anthropic API key */}
      <div className="rounded-3xl p-6 space-y-5" style={cardSty}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Anthropic API Key</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Used for AI fill on your lessons. Each user provides their own key — you are only charged for your own usage.
          </p>
        </div>

        {hasKey && maskedKey && (
          <div className="flex items-center justify-between rounded-full px-4 py-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>Current key</p>
              <p className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{maskedKey}</p>
            </div>
            <button
              onClick={handleRemoveKey}
              disabled={removingKey}
              className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition"
            >
              {removingKey ? "Removing…" : "Remove"}
            </button>
          </div>
        )}

        <form onSubmit={handleSaveKey} className="space-y-3">
          <label className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {hasKey ? "Replace key" : "Add key"}
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-api03-…"
            className={`${inputCls} font-mono`}
            style={inputSty}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Get your key from{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[#0cc0df] hover:underline">
              console.anthropic.com
            </a>
          </p>
          <button
            type="submit"
            disabled={savingKey || !keyInput.trim()}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingKey ? "Saving…" : "Save Key"}
          </button>
        </form>
      </div>
    </div>
  );
}
