import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { hashPasswordResetToken } from "../../../lib/auth/password-reset";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body && typeof body.token === "string" ? body.token.trim() : "";
  const password = body && typeof body.password === "string" ? body.password : "";
  if (!token) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  if (password.length < 8 || password.length > 200) return NextResponse.json({ error: "SHORT_PASSWORD" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hashPasswordResetToken(token),
      passwordResetExpiresAt: { gt: new Date() },
      isDeleted: false,
    },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
