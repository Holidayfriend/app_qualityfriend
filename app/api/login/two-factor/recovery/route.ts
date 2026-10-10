import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { clearTwoFactorChallenge, consumeTwoFactorChallenge, createSession, createTwoFactorEmailRecovery, verifyTwoFactorEmailRecovery } from "../../../../../lib/auth/session";
import { sendTwoFactorRecoveryEmail } from "../../../../../lib/auth/two-factor-recovery-email";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request) {
  const userId = await consumeTwoFactorChallenge();
  if (!userId) return NextResponse.json({ error: "CHALLENGE_EXPIRED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true, isDeleted: false, twoFactorEnabled: true }, select: { id: true, email: true, firstName: true, language: true, hotelTenantId: true, hotelTenant: { select: { subscriptionStatus: true } } } });
  if (!user) return NextResponse.json({ error: "CHALLENGE_EXPIRED" }, { status: 401 });

  if (action === "send") {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      const result = await sendTwoFactorRecoveryEmail({ to: user.email, firstName: user.firstName, code, locale: user.language.toLowerCase() as "en" | "de" | "it" });
      if (!result.sent) return NextResponse.json({ error: result.reason }, { status: 503 });
      await createTwoFactorEmailRecovery(user.id, code);
      return NextResponse.json({ success: true, maskedEmail: maskEmail(user.email) });
    } catch (error) {
      console.error("Two-factor recovery email failed", error);
      return NextResponse.json({ error: "EMAIL_FAILED" }, { status: 500 });
    }
  }

  if (action === "verify") {
    const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
    if (code.length !== 6) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
    const result = await verifyTwoFactorEmailRecovery(user.id, code);
    if (result !== "VALID") return NextResponse.json({ error: result === "EXPIRED" ? "CODE_EXPIRED" : "INVALID_CODE" }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [], twoFactorEnabledAt: null } });
      await recordAuditLog(tx, { module: "settings", hotelTenantId: user.hotelTenantId, actorId: user.id, action: "STATUS_CHANGE", entityType: "USER", entityId: user.id, changes: { field: "twoFactorEnabled", before: true, after: false, method: "verified_email_recovery" } });
    });
    await createSession(user.id);
    await clearTwoFactorChallenge();
    const active = ["ACTIVE", "COMPED"].includes(user.hotelTenant.subscriptionStatus);
    return NextResponse.json({ success: true, language: user.language.toLowerCase(), redirectTo: active ? "/settings/two-factor" : "/billing/subscribe" });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}
