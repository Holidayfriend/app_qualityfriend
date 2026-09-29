import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "../prisma";

const cookieName = "qualityfriend_session";
const challengeCookieName = "qualityfriend_2fa_challenge";
const emailRecoveryCookieName = "qualityfriend_2fa_email_recovery";
const mcpCookieName = "qualityfriend_mcp_session";
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
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { hotelTenantId: true, hotelTenant: { select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true, mcpUserDepartment: true } } } });
    const hotel = user?.hotelTenant;
    if (user && hotel?.activeMcp && hotel.mcpUserEmail && hotel.mcpUserPassword) {
      const { loginMcpUser } = await import("../mcp/client");
      const mcpToken = await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword);
      if (hotel.mcpHotelId) {
        const { syncMissingMcpDepartments } = await import("../mcp/department-sync");
        await syncMissingMcpDepartments(user.hotelTenantId, hotel.mcpHotelId, mcpToken);
        const { syncMissingMcpUsers } = await import("../mcp/user-sync");
        if (hotel.mcpUserDepartment) await syncMissingMcpUsers(user.hotelTenantId, { hotelId: hotel.mcpHotelId, defaultDepartmentId: hotel.mcpUserDepartment, token: mcpToken });
      }
      await setMcpSessionToken(mcpToken);
    }
  } catch (error) { console.error("MCP sign-in failed during QualityFriend login", error); }
}

export async function setMcpSessionToken(token: string) { (await cookies()).set(mcpCookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge }); }

export async function clearSession() {
  const store = await cookies(); store.delete(cookieName); store.delete(challengeCookieName); store.delete(emailRecoveryCookieName); store.delete(mcpCookieName);
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

export async function clearTwoFactorChallenge() { const store = await cookies(); store.delete(challengeCookieName); store.delete(emailRecoveryCookieName); }

export async function createTwoFactorEmailRecovery(userId: string, code: string) {
  const codeHash = createHmac("sha256", secret()).update(`2fa-email:${userId}:${code}`).digest("base64url");
  const payload = Buffer.from(JSON.stringify({ userId, codeHash, attempts: 5, expiresAt: Date.now() + 5 * 60 * 1000 })).toString("base64url");
  (await cookies()).set(emailRecoveryCookieName, `${payload}.${signature(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300 });
}

export async function verifyTwoFactorEmailRecovery(userId: string, code: string) {
  const store = await cookies();
  const token = store.get(emailRecoveryCookieName)?.value;
  if (!token) return "EXPIRED" as const;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature || signature(payload) !== providedSignature) return "EXPIRED" as const;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId?: string; codeHash?: string; attempts?: number; expiresAt?: number };
    if (data.userId !== userId || !data.codeHash || !data.expiresAt || data.expiresAt <= Date.now()) return "EXPIRED" as const;
    const expected = Buffer.from(data.codeHash);
    const actual = Buffer.from(createHmac("sha256", secret()).update(`2fa-email:${userId}:${code}`).digest("base64url"));
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) { store.delete(emailRecoveryCookieName); return "VALID" as const; }
    const attempts = (data.attempts ?? 0) - 1;
    if (attempts <= 0) { store.delete(emailRecoveryCookieName); return "EXPIRED" as const; }
    const nextPayload = Buffer.from(JSON.stringify({ ...data, attempts })).toString("base64url");
    store.set(emailRecoveryCookieName, `${nextPayload}.${signature(nextPayload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.max(1, Math.ceil((data.expiresAt - Date.now()) / 1000)) });
    return "INVALID" as const;
  } catch { return "EXPIRED" as const; }
}

export async function clearTwoFactorEmailRecovery() { (await cookies()).delete(emailRecoveryCookieName); }

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
    where: { id: userId, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } },
    select: { id: true },
  });
  return user?.id ?? null;
}
