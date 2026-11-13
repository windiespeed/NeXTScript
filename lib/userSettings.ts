import { getDb } from "@/lib/firebase";
import type { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/sectionLabels";
import type { SectionDef } from "@/types/section";
import { decryptSecret, encryptSecret, encryptionEnabled, isEncrypted } from "@/lib/secretBox";

export { DEFAULT_SECTION_LABELS, type SectionLabels };

const COLLECTION = "userSettings";

export interface UserSettings {
  anthropicKey?: string;
  geminiKey?: string;
  /** Profile → Advanced: "auto" or an AI model id (see lib/aiModels.ts). Absent = "auto". */
  preferredAiModel?: string;
  avatarUrl?: string;
  /** @deprecated AI sources live in course settings now; lib/profileCarryOver.ts moves old values there. */
  defaultSources?: string;
  folders?: string[];
  lessonOrder?: string[];
  /** @deprecated Industry, Subject Area and sections are course settings now; lib/profileCarryOver.ts moves old values there. */
  industry?: string;
  /** @deprecated see `industry`. */
  subject?: string;
  /** @deprecated see `industry`. */
  sectionLabels?: Partial<SectionLabels>;
  /** @deprecated see `industry`. */
  sections?: SectionDef[];
}

/** AI keys are stored encrypted (lib/secretBox.ts); everything else is plain. */
const SECRET_FIELDS = ["anthropicKey", "geminiKey"] as const;

export const userSettings = {
  /** Returns settings with AI keys decrypted. Legacy plaintext keys are re-saved encrypted. */
  async get(userId: string): Promise<UserSettings> {
    const doc = await getDb().collection(COLLECTION).doc(userId).get();
    if (!doc.exists) return {};
    const data = doc.data() as UserSettings;
    const toEncrypt: Partial<UserSettings> = {};
    for (const field of SECRET_FIELDS) {
      const value = data[field];
      if (typeof value !== "string") continue;
      if (encryptionEnabled() && !isEncrypted(value)) toEncrypt[field] = value;
      try {
        data[field] = decryptSecret(value);
      } catch (err) {
        // Wrong or missing server key: treat the key as absent so the rest of settings still load.
        console.error(`[userSettings] could not decrypt ${field}`, err);
        delete data[field];
      }
    }
    if (Object.keys(toEncrypt).length > 0) {
      // Best effort: a failure here just leaves the key in plaintext until the next read.
      userSettings.save(userId, toEncrypt).catch((err) => console.error("[userSettings] re-encrypt failed", err));
    }
    return data;
  },

  // A field value of FieldValue.delete() clears that field entirely — passing `undefined`
  // instead throws, since Firestore rejects literal undefined values unless
  // ignoreUndefinedProperties is enabled (it isn't, here).
  async save(userId: string, settings: { [K in keyof UserSettings]?: UserSettings[K] | FieldValue }): Promise<void> {
    const toWrite = { ...settings };
    for (const field of SECRET_FIELDS) {
      const value = toWrite[field];
      if (typeof value === "string") toWrite[field] = encryptSecret(value);
    }
    await getDb().collection(COLLECTION).doc(userId).set(toWrite as Partial<UserSettings>, { merge: true });
  },

  async getAnthropicKey(userId: string): Promise<string | null> {
    const s = await userSettings.get(userId);
    return s.anthropicKey ?? null;
  },

  async getGeminiKey(userId: string): Promise<string | null> {
    const s = await userSettings.get(userId);
    return s.geminiKey ?? null;
  },
};
