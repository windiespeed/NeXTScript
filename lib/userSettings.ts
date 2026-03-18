import { getDb } from "@/lib/firebase";

const COLLECTION = "userSettings";

interface UserSettings {
  anthropicKey?: string;
  avatarUrl?: string; // base64 data URL, resized to 200×200 client-side
  defaultSources?: string; // newline-separated URLs pre-filled on new lessons
  folders?: string[]; // named lesson folders on the dashboard
  defaultTemplateUrl?: string; // Google Slides template URL pre-filled in Generate modal
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
