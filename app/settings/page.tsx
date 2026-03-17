"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { status } = useSession({ required: true });
  const router = useRouter();

  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        setHasKey(data.hasKey);
        setMaskedKey(data.maskedKey);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSaving(true);
    setMessage("");
    setError("");
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anthropicKey: input.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setInput("");
      setHasKey(true);
      setMaskedKey(`${input.trim().slice(0, 12)}…${input.trim().slice(-4)}`);
      setMessage("API key saved.");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save.");
    }
  }

  async function handleRemove() {
    if (!confirm("Remove your Anthropic API key? AI features will be disabled until you add a new one.")) return;
    setRemoving(true);
    setMessage("");
    setError("");
    await fetch("/api/user/settings", { method: "DELETE" });
    setRemoving(false);
    setHasKey(false);
    setMaskedKey(null);
    setMessage("API key removed.");
  }

  if (status === "loading") return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[#0cc0df] hover:underline mb-4 block"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-black dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account preferences.</p>
      </div>

      <div className="rounded-xl border border-[#1e4a85]/30 bg-white dark:bg-[#112543] p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-[#0d1c35] dark:text-white">Anthropic API Key</h2>
          <p className="text-xs text-gray-500 mt-1">
            Your key is stored securely and used only for AI fill on your lessons. Each user provides their own key — you are only charged for your own usage.
          </p>
        </div>

        {hasKey && maskedKey && (
          <div className="flex items-center justify-between rounded-lg bg-[#f0f9ff] dark:bg-[#0d1c35] border border-[#1e4a85]/20 px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">Current key</p>
              <p className="text-sm font-mono text-[#0d1c35] dark:text-white">{maskedKey}</p>
            </div>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <label className="block text-sm font-semibold text-[#0d1c35] dark:text-white">
            {hasKey ? "Replace key" : "Add key"}
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="sk-ant-api03-…"
            className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm font-mono text-[#0d1c35] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
          />
          <p className="text-xs text-gray-400">
            Get your key from{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0cc0df] hover:underline"
            >
              console.anthropic.com
            </a>
          </p>
          <button
            type="submit"
            disabled={saving || !input.trim()}
            className="rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save Key"}
          </button>
        </form>

        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
