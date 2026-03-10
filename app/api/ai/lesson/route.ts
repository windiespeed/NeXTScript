import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const { title, subtitle, topics, sources } = await req.json();

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const sourcesSection = sources?.trim()
    ? `\nReference sources:\n${sources.trim()}`
    : "";

  const prompt = `You are a curriculum developer creating a lesson plan for a coding bootcamp.

Lesson title: ${title}
${subtitle ? `Lesson subtitle: ${subtitle}` : ""}
${topics ? `Topics covered: ${topics}` : ""}${sourcesSection}

Generate the following sections for this lesson. Return ONLY a valid JSON object with these exact keys — no markdown, no explanation:

{
  "overview": "Paragraph overview of everything covered in this lesson.",
  "learningTargets": "3–8 bullet points (each on its own line starting with •) of specific, measurable learning objectives.",
  "warmUp": "3–5 open-ended questions (each on its own line starting with a number and period) to engage students at the start of class.",
  "slideContent": "Slides separated by a line containing only ---. Each slide starts with the slide title on its own line, followed by the content (which may contain blank lines). Create 8–12 slides covering the topic progressively.",
  "guidedLab": "In-class instructor-led exercise. Must be step-by-step with numbered steps, including specific file and folder naming conventions.",
  "selfPaced": "Independent student exercise. Must be step-by-step with numbered steps, including specific file and folder naming conventions.",
  "submissionChecklist": "Specific requirements students must meet and turn in, as a bullet list starting each item with •.",
  "checkpoint": "3–5 common problems and challenges students may face, with suggested solutions. Format each as a problem followed by its solution.",
  "industryBestPractices": "Industry standards, best practices, and tips & tricks for this topic. Use bullet points starting with •.",
  "devJournalPrompt": "3–5 specific, evidence-based reflection questions for students to answer in their dev journal. Number each question.",
  "rubric": "Comprehension and objective checklist used by TAs to assess student submissions. Use bullet points starting with •."
}`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const fields = JSON.parse(jsonMatch[0]);
    return NextResponse.json(fields);
  } catch (err: any) {
    console.error("AI generation error:", err);
    if (err.message?.includes("credit balance is too low")) {
      return NextResponse.json({ error: "AI credits exhausted.", creditsError: true }, { status: 402 });
    }
    return NextResponse.json({ error: err.message || "AI generation failed" }, { status: 500 });
  }
}
