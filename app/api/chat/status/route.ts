import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { currentAccessUser } from "../../../../lib/auth/module-access";

export async function GET(){
 const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
 await prisma.user.update({where:{id:current.id},data:{lastSeenAt:new Date()}});
 const unreadCount=await prisma.chatMessage.count({where:{hotelTenantId:current.hotel_tenant_id,recipientId:current.id,readAt:null}});
 return NextResponse.json({unreadCount});
}
