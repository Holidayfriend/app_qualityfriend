import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { queryDatabase } from "../../../database";
import { createSession } from "../../../lib/auth/session";

type LoginUser = {
  id: string;
  password_hash: string;
  is_active: boolean;
  is_deleted: boolean;
  language: "EN" | "DE" | "IT";
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body && typeof body.password === "string" ? body.password : "";

  if (!email || !password) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

  const result = await queryDatabase<LoginUser>(
    `SELECT id, password_hash, is_active, is_deleted, language
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !validPassword || !user.is_active || user.is_deleted) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ success: true, language: user.language.toLowerCase() });
}
