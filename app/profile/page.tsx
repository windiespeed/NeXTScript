"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { DEFAULT_SECTIONS, type SectionDef } from "@/types/section";
import { resolveSections } from "@/lib/sections";
import SectionsEditor from "@/components/SectionsEditor";
import Avatar, { AVATAR_CHANGED_EVENT } from "@/components/Avatar";
import { useTheme } from "@/context/Theme";
import { clearDraft } from "@/lib/draftStorage";
import { useDraftAutosave, useDraftRestore } from "@/hooks/useDraftAutosave";

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

const inputCls = "w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] transition placeholder:text-[var(--text-muted)]";
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
  const [sections, setSections] = useState<SectionDef[]>(DEFAULT_SECTIONS);
  const [savingCurriculum, setSavingCurriculum] = useState(false);

  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);

  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string | null>(null);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);
  const [removingGeminiKey, setRemovingGeminiKey] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

  // Two independent forms, two independent drafts — sharing one key would mean saving
  // either form wipes the other's still-unsaved edits. keyInput (the raw pasted API key)
  // and the avatar File are deliberately never persisted: a secret credential and a
  // non-serializable Blob don't belong in localStorage.
  const sourcesDraftKey = "profile:sources";
  const curriculumDraftKey = "profile:curriculum";
  useDraftRestore<{ defaultSources: string }>(dataLoaded ? sourcesDraftKey : null, (draft) => {
    setDefaultSources(draft.defaultSources);
  });
  useDraftAutosave(sourcesDraftKey, { defaultSources }, dataLoaded);
  useDraftRestore<{ industry: string; subject: string; sections: SectionDef[] }>(dataLoaded ? curriculumDraftKey : null, (draft) => {
    setIndustry(draft.industry);
    setSubject(draft.subject);
    setSections(draft.sections);
  });
  useDraftAutosave(curriculumDraftKey, { industry, subject, sections }, dataLoaded);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        setHasKey(data.hasKey);
        setMaskedKey(data.maskedKey);
        setHasGeminiKey(data.hasGeminiKey);
        setMaskedGeminiKey(data.maskedGeminiKey);
        setAvatarUrl(data.avatarUrl ?? null);
        setDefaultSources(data.defaultSources ?? "");
        setIndustry(data.industry ?? "");
        setSubject(data.subject ?? "");
        setSections(resolveSections({ userSettings: { sectionLabels: data.sectionLabels, sections: data.sections } }));
      })
      .finally(() => setDataLoaded(true));
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
      window.dispatchEvent(new CustomEvent(AVATAR_CHANGED_EVENT, { detail: base64 }));
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
    const res = await fetch("/api/user/avatar", { method: "DELETE" }).catch(() => null);
    setRemovingAvatar(false);
    if (!res?.ok) { flash("Couldn't remove your photo. Please try again.", true); return; }
    setAvatarUrl(null);
    window.dispatchEvent(new CustomEvent(AVATAR_CHANGED_EVENT, { detail: null }));
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
    if (res.ok) { clearDraft(sourcesDraftKey); flash("Default sources saved."); }
    else { const d = await res.json(); flash(d.error || "Failed to save.", true); }
  }

  async function handleSaveCurriculum(e: React.FormEvent) {
    e.preventDefault();
    setSavingCurriculum(true);
    flash("");
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry, subject, sections }),
    });
    setSavingCurriculum(false);
    if (res.ok) { clearDraft(curriculumDraftKey); flash("Curriculum settings saved."); }
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
    await fetch("/api/user/settings?key=anthropic", { method: "DELETE" });
    setRemovingKey(false);
    setHasKey(false);
    setMaskedKey(null);
    flash("API key removed.");
  }

  async function handleSaveGeminiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!geminiKeyInput.trim()) return;
    setSavingGeminiKey(true);
    flash("");
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiKey: geminiKeyInput.trim() }),
    });
    setSavingGeminiKey(false);
    if (res.ok) {
      const k = geminiKeyInput.trim();
      setHasGeminiKey(true);
      setMaskedGeminiKey(`${k.slice(0, 12)}…${k.slice(-4)}`);
      setGeminiKeyInput("");
      flash("API key saved.");
    } else {
      const d = await res.json();
      flash(d.error || "Failed to save.", true);
    }
  }

  async function handleRemoveGeminiKey() {
    if (!confirm("Remove your Gemini API key? Gemini will no longer be available as a model option.")) return;
    setRemovingGeminiKey(true);
    flash("");
    await fetch("/api/user/settings?key=gemini", { method: "DELETE" });
    setRemovingGeminiKey(false);
    setHasGeminiKey(false);
    setMaskedGeminiKey(null);
    flash("API key removed.");
  }

  if (status === "loading") return null;


  return (
    <div className="space-y-6">
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
              className="group relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
              aria-label="Upload profile photo"
            >
              <div className="w-full h-full bg-[#0cc0df]/20 flex items-center justify-center">
                <Avatar
                  sources={[avatarUrl, session?.user?.image]}
                  name={session?.user?.name}
                  email={session?.user?.email}
                  alt="Profile"
                  initialsClassName="text-2xl font-bold text-[var(--accent-text)]"
                />
              </div>
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 group-disabled:opacity-0 transition-opacity rounded-full">
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
                className="text-xs text-[var(--accent-text)] hover:underline disabled:opacity-50"
              >
                {uploadingAvatar ? "Uploading…" : "Upload photo"}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={removingAvatar}
                  className="text-xs text-[var(--danger-text)] hover:underline disabled:opacity-50"
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
      {message && <p role="status" className="text-sm text-[var(--success-text)]">{message}</p>}
      {error && <p role="alert" className="text-sm text-[var(--danger-text)]">{error}</p>}

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
          <textarea aria-label="Default sources"
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
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-[#0a0b13] shadow hover:opacity-90 disabled:opacity-50 transition"
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
              <label htmlFor="profile-industry" className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Industry</label>
              <input id="profile-industry"
                type="text"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Healthcare, Coding, Business"
                className={inputCls}
                style={inputSty}
              />
            </div>
            <div>
              <label htmlFor="profile-subject-area" className="block text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Subject Area</label>
              <input id="profile-subject-area"
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
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Sections</p>
            <SectionsEditor scope="user" value={sections} onChange={setSections} />
          </div>

          <button
            type="submit"
            disabled={savingCurriculum}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-[#0a0b13] shadow hover:opacity-90 disabled:opacity-50 transition"
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
              className="text-xs text-[var(--danger-text)] hover:text-[var(--danger-text)] disabled:opacity-50 transition"
            >
              {removingKey ? "Removing…" : "Remove"}
            </button>
          </div>
        )}

        <form onSubmit={handleSaveKey} className="space-y-3">
          <label htmlFor="profile-input" className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {hasKey ? "Replace key" : "Add key"}
          </label>
          <input id="profile-input"
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-api03-…"
            className={`${inputCls} font-mono`}
            style={inputSty}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Get your key from{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] hover:underline">
              console.anthropic.com
            </a>
          </p>
          <button
            type="submit"
            disabled={savingKey || !keyInput.trim()}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-[#0a0b13] shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingKey ? "Saving…" : "Save Key"}
          </button>
        </form>
      </div>

      {/* Gemini API key */}
      <div className="rounded-3xl p-6 space-y-5" style={cardSty}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Gemini API Key</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Used for the Gemini model options on Notes to Slides. Each user provides their own key — you are only charged for your own usage.
          </p>
        </div>

        {hasGeminiKey && maskedGeminiKey && (
          <div className="flex items-center justify-between rounded-full px-4 py-3" style={{ background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>Current key</p>
              <p className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{maskedGeminiKey}</p>
            </div>
            <button
              onClick={handleRemoveGeminiKey}
              disabled={removingGeminiKey}
              className="text-xs text-[var(--danger-text)] hover:text-[var(--danger-text)] disabled:opacity-50 transition"
            >
              {removingGeminiKey ? "Removing…" : "Remove"}
            </button>
          </div>
        )}

        <form onSubmit={handleSaveGeminiKey} className="space-y-3">
          <label htmlFor="profile-input-2" className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {hasGeminiKey ? "Replace key" : "Add key"}
          </label>
          <input id="profile-input-2"
            type="password"
            value={geminiKeyInput}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
            placeholder="AIzaSy…"
            className={`${inputCls} font-mono`}
            style={inputSty}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Get your key from{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] hover:underline">
              aistudio.google.com
            </a>
          </p>
          <button
            type="submit"
            disabled={savingGeminiKey || !geminiKeyInput.trim()}
            className="rounded-full bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-[#0a0b13] shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {savingGeminiKey ? "Saving…" : "Save Key"}
          </button>
        </form>
      </div>
    </div>
  );
}
