import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createSession, createTwoFactorChallenge } from "../../../lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body && typeof body.password === "string" ? body.password : "";

  if (!email || !password) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

  const user=await prisma.user.findUnique({where:{email},select:{id:true,passwordHash:true,isActive:true,isDeleted:true,language:true,twoFactorEnabled:true,hotelTenant:{select:{subscriptionStatus:true}}}});
  const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !validPassword || !user.isActive || user.isDeleted) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  if(user.twoFactorEnabled){await createTwoFactorChallenge(user.id);return NextResponse.json({success:true,requiresTwoFactor:true,language:user.language.toLowerCase()})}
  await createSession(user.id);
  return NextResponse.json({ success: true, language: user.language.toLowerCase(), redirectTo: user.hotelTenant.subscriptionStatus === "ACTIVE" ? "/dashboard" : "/billing/subscribe" });
}
