import { getDb } from "@/lib/firebase";
import type { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/sectionLabels";
import type { SectionDef } from "@/types/section";

export { DEFAULT_SECTION_LABELS, type SectionLabels };

const COLLECTION = "userSettings";

export function getMergedLabels(settings: { sectionLabels?: Partial<SectionLabels> }): SectionLabels {
  return { ...DEFAULT_SECTION_LABELS, ...settings.sectionLabels };
}

export interface UserSettings {
  anthropicKey?: string;
  avatarUrl?: string;
  defaultSources?: string;
  folders?: string[];
  lessonOrder?: string[];
  industry?: string;
  subject?: string;
  /** @deprecated superseded by `sections` below — kept as a synthesis input, never migrated. */
  sectionLabels?: Partial<SectionLabels>;
  sections?: SectionDef[];
}

export const userSettings = {
  async get(userId: string): Promise<UserSettings> {
    const doc = await getDb().collection(COLLECTION).doc(userId).get();
    if (!doc.exists) return {};
    return doc.data() as UserSettings;
  },

  // A field value of FieldValue.delete() clears that field entirely — passing `undefined`
  // instead throws, since Firestore rejects literal undefined values unless
  // ignoreUndefinedProperties is enabled (it isn't, here).
  async save(userId: string, settings: { [K in keyof UserSettings]?: UserSettings[K] | FieldValue }): Promise<void> {
    await getDb().collection(COLLECTION).doc(userId).set(settings as Partial<UserSettings>, { merge: true });
  },

  async getAnthropicKey(userId: string): Promise<string | null> {
    const s = await userSettings.get(userId);
    return s.anthropicKey ?? null;
  },
};
