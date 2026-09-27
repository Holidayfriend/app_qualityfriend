import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { unreadChatCount } from "../../../../lib/chat/directory";

export async function GET(){
 const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
 await prisma.user.update({where:{id:current.id},data:{lastSeenAt:new Date()}});
 const unreadCount=await unreadChatCount(current.id, current.hotel_tenant_id, current.role);
 return NextResponse.json({unreadCount});
}
