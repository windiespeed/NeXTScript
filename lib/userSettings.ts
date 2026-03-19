import { getDb } from "@/lib/firebase";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/sectionLabels";

export { DEFAULT_SECTION_LABELS, type SectionLabels };

const COLLECTION = "userSettings";

export function getMergedLabels(settings: { sectionLabels?: Partial<SectionLabels> }): SectionLabels {
  return { ...DEFAULT_SECTION_LABELS, ...settings.sectionLabels };
}

interface UserSettings {
  anthropicKey?: string;
  avatarUrl?: string;
  defaultSources?: string;
  folders?: string[];
  defaultTemplateUrl?: string;
  lessonOrder?: string[];
  industry?: string;
  subject?: string;
  sectionLabels?: Partial<SectionLabels>;
}

export const userSettings = {
  async get(userId: string): Promise<UserSettings> {
    const doc = await getDb().collection(COLLECTION).doc(userId).get();
    if (!doc.exists) return {};
    return doc.data() as UserSettings;
  },

  async save(userId: string, settings: Partial<UserSettings>): Promise<void> {
    await getDb().collection(COLLECTION).doc(userId).set(settings, { merge: true });
  },

  async getAnthropicKey(userId: string): Promise<string | null> {
    const s = await userSettings.get(userId);
    return s.anthropicKey ?? null;
  },
};
