"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Slide {
  title: string;
  body: string;
}

function extractPresentationId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function NewSlideDeckPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [templateUrl, setTemplateUrl] = useState("");
  const [slides, setSlides] = useState<Slide[]>([{ title: "", body: "" }]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState("");

  if (status === "loading") return null;
  if (!session) {
    router.replace("/");
    return null;
  }

  function setSlide(i: number, field: keyof Slide, value: string) {
    setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function addSlide() {
    setSlides(prev => [...prev, { title: "", body: "" }]);
  }

  function removeSlide(i: number) {
    setSlides(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!title.trim()) { setError("Title is required."); return; }
    const validSlides = slides.filter(s => s.title.trim() || s.body.trim());
    if (validSlides.length === 0) { setError("Add at least one slide with content."); return; }

    const templateId = templateUrl.trim() ? extractPresentationId(templateUrl.trim()) ?? undefined : undefined;

    setGenerating(true);
    try {
      const res = await fetch("/api/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, slides: validSlides, templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult({ url: data.url });
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#112543] dark:text-white">Slide Deck Builder</h1>
        <p className="text-sm text-gray-500 mt-1">Create a custom Google Slides presentation.</p>
      </div>

      {result && (
        <div className="mb-6 rounded-md bg-[#2dd4a0]/10 border border-[#2dd4a0] p-4">
          <p className="text-sm font-semibold text-[#112543] mb-1">Slide deck created!</p>
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0cc0df] underline break-all">
            Open in Google Slides
          </a>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Meta */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#112543] dark:text-white mb-1">
              Deck Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to HTML"
              className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#112543] dark:text-white mb-1">Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="e.g. Tags, Attributes, and Structure"
              className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#112543] dark:text-white mb-1">Slides Template URL (optional)</label>
            <input
              type="url"
              value={templateUrl}
              onChange={e => setTemplateUrl(e.target.value)}
              placeholder="https://docs.google.com/presentation/d/..."
              className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
            />
          </div>
        </div>

        {/* Slides */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-[#112543] dark:text-white">Slides</p>
              <p className="text-xs text-gray-500">Each card is one slide.</p>
            </div>
            <button
              type="button"
              onClick={addSlide}
              className="rounded-md bg-[#112543] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e4a85] transition"
            >
              + Add Slide
            </button>
          </div>

          <div className="space-y-3">
            {slides.map((slide, i) => (
              <div key={i} className="rounded-lg border border-[#1e4a85]/20 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slide {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeSlide(i)}
                    disabled={slides.length === 1}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 transition"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={slide.title}
                  onChange={e => setSlide(i, "title", e.target.value)}
                  placeholder="Slide title"
                  className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                />
                <textarea
                  value={slide.body}
                  onChange={e => setSlide(i, "body", e.target.value)}
                  rows={4}
                  placeholder="Slide content…"
                  className="w-full rounded-md border border-[#1e4a85]/30 px-3 py-2 text-sm text-[#112543] font-mono bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0cc0df]"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={generating}
          className="w-full rounded-md bg-gradient-to-r from-[#ff8c4a] to-[#e55a1e] px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 transition"
        >
          {generating ? "Generating…" : "Generate Slide Deck"}
        </button>
      </form>
    </main>
  );
}
