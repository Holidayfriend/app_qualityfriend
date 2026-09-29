import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { prisma } from "../../../../../lib/prisma";

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, hotelTenantId: true } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return NextResponse.json({ error: "CURRENT_PASSWORD_INCORRECT" }, { status: 400 });
  if (await bcrypt.compare(newPassword, user.passwordHash)) return NextResponse.json({ error: "PASSWORD_REUSED" }, { status: 400 });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null } });
    await recordAuditLog(tx, { hotelTenantId: user.hotelTenantId, actorId: userId, action: "UPDATE", entityType: "USER", entityId: userId, changes: { passwordChanged: true } });
  });
  return NextResponse.json({ success: true });
}
