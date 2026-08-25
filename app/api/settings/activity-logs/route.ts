import { NextResponse } from "next/server";
import { queryDatabase } from "../../../../database";
import { getSessionUserId } from "../../../../lib/auth/session";

type Actor = { id: string; hotel_tenant_id: string; role: "OWNER" | "ADMIN" | "USER" };

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const actorResult = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id, role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1`, [userId]);
  const actor = actorResult.rows[0];
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const owner = actor.role === "OWNER";
  const result = await queryDatabase(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.changes, l.created_at,
            COALESCE(u.first_name || ' ' || u.last_name, 'Deleted user') AS actor_name
     FROM audit_logs l
     LEFT JOIN users u ON u.id = l.actor_id
     WHERE l.hotel_tenant_id = $1 AND ($2::boolean OR l.actor_id = $3)
     ORDER BY l.created_at DESC
     LIMIT 250`,
    [actor.hotel_tenant_id, owner, actor.id],
  );
  return NextResponse.json({ canViewAll: owner, logs: result.rows });
}
