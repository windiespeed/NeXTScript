/**
 * Encryption at rest for secrets stored in Firestore (users' AI API keys).
 *
 * AES-256-GCM with a server key from SETTINGS_ENCRYPTION_KEY (32 bytes, base64;
 * generate with `openssl rand -base64 32`). Encrypted values look like
 * "enc:v1:<iv>:<tag>:<ciphertext>". Values without that prefix are legacy
 * plaintext and are returned as-is, so existing keys keep working and get
 * encrypted the next time they're read or saved.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(raw = process.env.SETTINGS_ENCRYPTION_KEY): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptionEnabled(): boolean {
  return getKey() !== null;
}

/** Encrypts a value. Without a configured key, returns it unchanged. */
export function encryptSecret(plain: string, rawKey?: string): string {
  const key = getKey(rawKey);
  if (!key || isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypts a value written by encryptSecret. Plaintext (legacy) values pass through. */
export function decryptSecret(stored: string, rawKey?: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = getKey(rawKey);
  if (!key) throw new Error("A stored key is encrypted but SETTINGS_ENCRYPTION_KEY is not set.");
  const [iv, tag, ct] = stored.slice(PREFIX.length).split(":").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
