import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.LIVE_SESSIONS_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("LIVE_SESSIONS_ENCRYPTION_KEY is not configured");
  }

  // Always derive a 32-byte key from the env value to avoid key length mismatches.
  return crypto.createHash("sha256").update(rawKey).digest();
}

export function encryptLiveSessionSecret(plainText: string): string {
  if (!plainText) return "";

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}:${encrypted.toString("base64url")}:${tag.toString("base64url")}`;
}

export function decryptLiveSessionSecret(payload: string | null | undefined): string {
  if (!payload) return "";

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivPart, dataPart, tagPart] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivPart, "base64url");
  const encryptedData = Buffer.from(dataPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
