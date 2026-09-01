import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function key(source = process.env.TOTP_ENCRYPTION_KEY || process.env.AUTH_SECRET) {
  if (!source) throw new Error("TOTP_ENCRYPTION_KEY or AUTH_SECRET must be configured.");
  return createHash("sha256").update(source).digest();
}

export function generateTotpSecret() {
  const bytes = randomBytes(20); let output = "", bits = 0, value = 0;
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(secret: string) {
  let bits = 0, value = 0; const bytes: number[] = [];
  for (const character of secret.replace(/=+$/g, "").toUpperCase()) { const index = alphabet.indexOf(character); if (index < 0) continue; value = (value << 5) | index; bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(bytes);
}

function totp(secret: string, timestamp: number) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest(); const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string) {
  const normalized = code.replace(/\s/g, ""); if (!/^\d{6}$/.test(normalized)) return false;
  const now = Date.now(); return [-1, 0, 1].some(window => totp(secret, now + window * 30000) === normalized);
}

export function encryptSecret(secret: string) { const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv),encrypted=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`; }
export function decryptSecret(value: string) { const[iv,tag,data]=value.split(".").map(part=>Buffer.from(part,"base64url"));const legacyDevelopmentKey=process.env.NODE_ENV!=="production"?"qualityfriend_local_development_totp_encryption_secret":undefined;const sources=[process.env.TOTP_ENCRYPTION_KEY,process.env.AUTH_SECRET,legacyDevelopmentKey].filter((source,index,all):source is string=>Boolean(source)&&all.indexOf(source)===index);for(const source of sources){try{const decipher=createDecipheriv("aes-256-gcm",key(source),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8")}catch{/* Try the previous configured key for secrets created before key separation. */}}throw new Error("TWO_FACTOR_SECRET_DECRYPTION_FAILED"); }
export function generateRecoveryCodes(){return Array.from({length:8},()=>`${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`)}
export function hashRecoveryCode(code:string){return createHash("sha256").update(code.replace(/\s/g,"").toUpperCase()).digest("hex")}
export function otpauthUri(secret:string,email:string){return `otpauth://totp/${encodeURIComponent(`QualityFriend:${email}`)}?secret=${secret}&issuer=${encodeURIComponent("QualityFriend")}&algorithm=SHA1&digits=6&period=30`}
