import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "qualityfriend_session";
const maxAge = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + maxAge * 1000 })).toString("base64url");
  const token = `${payload}.${signature(payload)}`;
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
}

export async function clearSession() {
  (await cookies()).delete(cookieName);
}

export async function getSessionUserId() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;
  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId?: string; expiresAt?: number };
    return data.userId && data.expiresAt && data.expiresAt > Date.now() ? data.userId : null;
  } catch {
    return null;
  }
}
