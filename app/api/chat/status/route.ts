import { NextResponse } from "next/server";
import { queryDatabase } from "../../../../database";
import { currentAccessUser } from "../../../../lib/auth/module-access";

export async function GET(){
 const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
 await queryDatabase(`UPDATE users SET last_seen_at=NOW() WHERE id=$1`,[current.id]);
 const unread=await queryDatabase<{count:number}>(`SELECT count(*)::int AS count FROM chat_messages WHERE hotel_tenant_id=$1 AND recipient_id=$2 AND read_at IS NULL`,[current.hotel_tenant_id,current.id]);
 return NextResponse.json({unreadCount:unread.rows[0]?.count??0});
}
