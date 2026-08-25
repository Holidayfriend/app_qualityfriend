import { NextResponse } from "next/server";
import { queryDatabase } from "../../../database";
import { currentAccessUser } from "../../../lib/auth/module-access";

export async function GET() {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const users = await queryDatabase(`
    SELECT u.id,u.first_name,u.last_name,u.role,u.last_seen_at,(u.last_seen_at > NOW() - INTERVAL '90 seconds') AS is_online,
      (SELECT COALESCE(m.text,m.attachment_name) FROM chat_messages m WHERE m.hotel_tenant_id=$1 AND ((m.sender_id=$2 AND m.recipient_id=u.id) OR (m.sender_id=u.id AND m.recipient_id=$2)) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT m.created_at FROM chat_messages m WHERE m.hotel_tenant_id=$1 AND ((m.sender_id=$2 AND m.recipient_id=u.id) OR (m.sender_id=u.id AND m.recipient_id=$2)) ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
      (SELECT count(*)::int FROM chat_messages m WHERE m.sender_id=u.id AND m.recipient_id=$2 AND m.read_at IS NULL) AS unread_count
    FROM users u WHERE u.hotel_tenant_id=$1 AND u.id<>$2 AND u.is_active=true AND u.is_deleted=false
    ORDER BY last_message_at DESC NULLS LAST,u.first_name,u.last_name`, [current.hotel_tenant_id,current.id]);
  return NextResponse.json({ currentUserId: current.id, users: users.rows });
}
