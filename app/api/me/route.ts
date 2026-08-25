import { NextResponse } from "next/server";
import { queryDatabase } from "../../../database";
import { getSessionUserId } from "../../../lib/auth/session";

type CurrentUser = { first_name: string; last_name: string; role: string; hotel_name_en: string; hotel_name_de: string; hotel_name_it: string };

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const result = await queryDatabase<CurrentUser>(
    `SELECT u.first_name, u.last_name, u.role, h.hotel_name_en, h.hotel_name_de, h.hotel_name_it
     FROM users u JOIN hotel_tenants h ON h.id = u.hotel_tenant_id
     WHERE u.id = $1 AND u.is_active = true AND u.is_deleted = false AND h.is_active = true LIMIT 1`,
    [userId],
  );
  const user = result.rows[0];
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json(user);
}
