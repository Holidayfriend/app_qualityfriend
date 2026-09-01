import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "../prisma";

const cookieName = "qualityfriend_session";
const challengeCookieName = "qualityfriend_2fa_challenge";
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
  const store = await cookies(); store.delete(cookieName); store.delete(challengeCookieName);
}

export async function createTwoFactorChallenge(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 5 * 60 * 1000 })).toString("base64url");
  (await cookies()).set(challengeCookieName, `${payload}.${signature(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300 });
}

export async function consumeTwoFactorChallenge() {
  const store = await cookies(), token = store.get(challengeCookieName)?.value; if (!token) return null;
  const [payload, providedSignature] = token.split("."); if (!payload || !providedSignature || signature(payload) !== providedSignature) return null;
  try { const data=JSON.parse(Buffer.from(payload,"base64url").toString()) as {userId?:string;expiresAt?:number};return data.userId&&data.expiresAt&&data.expiresAt>Date.now()?data.userId:null; } catch { return null; }
}

export async function clearTwoFactorChallenge() { (await cookies()).delete(challengeCookieName); }

export async function getRawSessionUserId() {
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

export async function getSessionUserId() {
  const userId = await getRawSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: "ACTIVE" } },
    select: { id: true },
  });
  return user?.id ?? null;
}
