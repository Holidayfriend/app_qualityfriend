import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(source = process.env.TOTP_ENCRYPTION_KEY || process.env.AUTH_SECRET) {
  if (!source) throw new Error("TOTP_ENCRYPTION_KEY or AUTH_SECRET must be configured.");
  return createHash("sha256").update(source).digest();
}

export function encryptAiSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptAiSecret(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const legacyDevelopmentKey = process.env.NODE_ENV !== "production" ? "qualityfriend_local_development_totp_encryption_secret" : undefined;
  const sources = [process.env.TOTP_ENCRYPTION_KEY, process.env.AUTH_SECRET, legacyDevelopmentKey].filter((source, index, all): source is string => Boolean(source) && all.indexOf(source) === index);
  for (const source of sources) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key(source), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch {
      /* try next key */
    }
  }
  throw new Error("AI_SECRET_DECRYPTION_FAILED");
}
