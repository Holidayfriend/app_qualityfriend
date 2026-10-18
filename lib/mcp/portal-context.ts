import "server-only";
import { getPersonalMcpSession, getSessionUserId, refreshMcpSession } from "../auth/session";

export async function getMcpPortalContext() {
  const userId = await getSessionUserId();
  if (!userId) return { error: "UNAUTHENTICATED" as const, status: 401 };
  let session = await getPersonalMcpSession(userId);
  if (!session) {
    await refreshMcpSession(userId);
    session = await getPersonalMcpSession(userId);
  }
  if (!session) return { error: "MCP_USER_NOT_SYNCED" as const, status: 409 };
  return { userId, ...session };
}
