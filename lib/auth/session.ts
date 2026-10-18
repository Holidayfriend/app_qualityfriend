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
  const store = await cookies();
  store.set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  store.delete(mcpCookieName);
  try { await refreshMcpSession(userId); }
  catch (error) { console.error("MCP sign-in failed during QualityFriend login", error); }
}

export async function setMcpSessionToken(token: string) { (await cookies()).set(mcpCookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge }); }

export async function getMcpSessionToken() {
  return (await cookies()).get(mcpCookieName)?.value ?? null;
}

export async function setPersonalMcpSessionToken(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, isDeleted: false },
    select: { id: true, email: true, mcpUserId: true, mcpUserPassword: true },
  });
  if (!user?.mcpUserId || !user.mcpUserPassword) return null;
  const { loginSyncedMcpUser } = await import("../mcp/user-sync");
  const token = await loginSyncedMcpUser(user.id, user.email, user.mcpUserPassword);
  await setMcpSessionToken(token);
  return token;
}

export async function getPersonalMcpSession(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, isDeleted: false },
    select: { id: true, email: true, mcpUserId: true, mcpUserPassword: true },
  });
  if (!user?.mcpUserId || !user.mcpUserPassword) return null;

  const { getMcpProfile } = await import("../mcp/client");
  let token = await getMcpSessionToken();
  if (token) {
    try {
      const profile = await getMcpProfile(token);
      if (profile.id === user.mcpUserId) return { token, profile };
    } catch {
      // A missing or expired MCP token is renewed below using the stored user credentials.
    }
  }

  token = await setPersonalMcpSessionToken(userId);
  if (!token) return null;
  const profile = await getMcpProfile(token);
  if (profile.id !== user.mcpUserId) throw new Error("The MCP session does not belong to the signed-in QualityFriend user.");
  return { token, profile };
}

export async function refreshMcpSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      hotelTenantId: true,
      hotelTenant: {
        select: {
          activeMcp: true,
          mcpHotelId: true,
          mcpUserEmail: true,
          mcpUserPassword: true,
          mcpUserDepartment: true,
        },
      },
    },
  });
  const hotel = user?.hotelTenant;
  if (!user || !hotel?.activeMcp || !hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword || !hotel.mcpUserDepartment) return false;

  const { loginMcpUser } = await import("../mcp/client");
  const serviceToken = await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword);
  const { syncMissingMcpDepartments } = await import("../mcp/department-sync");
  await syncMissingMcpDepartments(user.hotelTenantId, hotel.mcpHotelId, serviceToken);
  const { ensureMcpUser, syncMissingMcpUsers } = await import("../mcp/user-sync");
  const context = { hotelId: hotel.mcpHotelId, defaultDepartmentId: hotel.mcpUserDepartment, token: serviceToken };

  // Prioritize the person who is signing in so another user's sync failure cannot
  // prevent the current user from receiving a personal MCP session.
  await ensureMcpUser(userId, context);
  try { await syncMissingMcpUsers(user.hotelTenantId, context); }
  catch (error) { console.error("Some MCP users could not be synchronized during login", error); }
  return setPersonalMcpSessionToken(userId);
}

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
