import { NextResponse } from "next/server";
import { queryDatabase } from "../../../../database";
import { getSessionUserId } from "../../../../lib/auth/session";

type Actor = { id: string; hotel_tenant_id: string; role: "EMPLOYEE" | "TEAM_LEAD" | "MANAGEMENT" | "ADMIN" };

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const actorResult = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id, role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1`, [userId]);
  const actor = actorResult.rows[0];
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const administrator = actor.role === "ADMIN";
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");
  const requestedDate = url.searchParams.get("date");
  const validDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : null;
  let filteredUserId = actor.id;
  if (administrator && requestedUserId) {
    const allowedUser = await queryDatabase<{ id: string }>(`SELECT id FROM users WHERE id = $1 AND hotel_tenant_id = $2 LIMIT 1`, [requestedUserId, actor.hotel_tenant_id]);
    filteredUserId = allowedUser.rows[0]?.id ?? actor.id;
  }
  const result = await queryDatabase(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.changes, l.description, l.created_at,
            COALESCE(u.first_name || ' ' || u.last_name, 'Deleted user') AS actor_name
     FROM audit_logs l
     LEFT JOIN users u ON u.id = l.actor_id
     WHERE l.hotel_tenant_id = $1
       AND ($2::boolean OR l.actor_id = $3)
       AND ($4::uuid IS NULL OR l.actor_id = $4::uuid)
       AND ($5::date IS NULL OR l.created_at >= $5::date AND l.created_at < $5::date + INTERVAL '1 day')
     ORDER BY l.created_at DESC
     LIMIT 250`,
    [actor.hotel_tenant_id, administrator, actor.id, administrator && requestedUserId ? filteredUserId : null, validDate],
  );
  const users = administrator ? await queryDatabase(`SELECT id, first_name, last_name FROM users WHERE hotel_tenant_id = $1 ORDER BY first_name, last_name`, [actor.hotel_tenant_id]) : null;
  return NextResponse.json({ canViewAll: administrator, logs: result.rows, users: users?.rows ?? [] });
}
