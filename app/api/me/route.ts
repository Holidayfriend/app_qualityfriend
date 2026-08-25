import { NextResponse } from "next/server";
import { queryDatabase } from "../../../database";
import { getSessionUserId } from "../../../lib/auth/session";

type CurrentUser = { first_name: string; last_name: string; role: string; language: "EN" | "DE" | "IT"; hotel_name_en: string; hotel_name_de: string; hotel_name_it: string };

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const result = await queryDatabase<CurrentUser>(
    `SELECT u.first_name, u.last_name, u.role, u.language, h.hotel_name_en, h.hotel_name_de, h.hotel_name_it
     FROM users u JOIN hotel_tenants h ON h.id = u.hotel_tenant_id
     WHERE u.id = $1 AND u.is_active = true AND u.is_deleted = false AND h.is_active = true LIMIT 1`,
    [userId],
  );
  const user = result.rows[0];
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const language = body && typeof body.language === "string" ? body.language.toUpperCase() : "";
  if (!new Set(["EN", "DE", "IT"]).has(language)) return NextResponse.json({ error: "INVALID_LANGUAGE" }, { status: 400 });
  await queryDatabase(`UPDATE users SET language = $1::"HotelLanguage", updated_at = NOW() WHERE id = $2`, [language, userId]);
  return NextResponse.json({ success: true });
}
