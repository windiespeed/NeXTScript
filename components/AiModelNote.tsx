import Link from "next/link";
import { getAiModel, resolveAiModel, type AiProvider, type SavedKeys } from "@/lib/aiModels";

/**
 * One line telling the instructor which AI model a generator will use, in place of a model menu.
 * The server makes the same choice (lib/aiModels.ts resolveAiModel), so this is display only.
 */
export default function AiModelNote({
  preference,
  keys,
  providers,
  id,
}: {
  preference: unknown;
  keys: SavedKeys | null;
  providers?: readonly AiProvider[];
  id?: string;
}) {
  if (!keys) return null;
  const model = resolveAiModel(preference, keys, providers);
  return (
    <p id={id} className="text-xs" style={{ color: "var(--text-muted)" }}>
      {model ? <>Uses {getAiModel(model).label} with your saved key. </> : <>Add an API key to generate. </>}
      <Link href="/profile#ai-model" className="font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
        {model ? "Change in Profile" : "Go to Profile"}
      </Link>
    </p>
  );
}
