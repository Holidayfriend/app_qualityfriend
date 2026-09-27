import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createPasswordResetToken, publicBaseUrl } from "../../../lib/auth/password-reset";
import { sendPasswordResetEmail } from "../../../lib/auth/password-reset-email";

const emailPattern = /^\S+@\S+\.\S+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !emailPattern.test(email)) return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, language: true, isDeleted: true },
  });
  if (!user || user.isDeleted) return NextResponse.json({ error: "NOT_REGISTERED" }, { status: 404 });

  const { token, tokenHash, expiresAt } = createPasswordResetToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
  });

  const language = user.language.toLowerCase();
  const locale = language === "de" || language === "it" ? language : "en";
  const resetUrl = `${publicBaseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    const result = await sendPasswordResetEmail({ to: email, firstName: user.firstName, resetUrl, locale });
    if (!result.sent) return NextResponse.json({ error: "MAIL_FAILED" }, { status: 503 });
  } catch (error) {
    console.error("Password reset email failed", error);
    return NextResponse.json({ error: "MAIL_FAILED" }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}
