import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { currentAccessUser } from "../../../../../lib/auth/module-access";

export async function GET(request:Request,{params}:{params:Promise<{messageId:string}>}){
 const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});const{messageId}=await params;
 const item=await prisma.chatMessage.findFirst({where:{id:messageId,hotelTenantId:current.hotel_tenant_id,attachmentPath:{not:null}},select:{attachmentPath:true,attachmentName:true,attachmentMime:true,senderId:true,recipientId:true,teamId:true,departmentId:true}});if(!item?.attachmentPath||!item.attachmentName||!item.attachmentMime)return NextResponse.json({error:"NOT_FOUND"},{status:404});const inChannel=item.teamId?await prisma.userTeam.findFirst({where:{userId:current.id,teamId:item.teamId},select:{userId:true}}):item.departmentId?await prisma.user.findFirst({where:{id:current.id,departmentId:item.departmentId},select:{id:true}}):null;const allowed=item.senderId===current.id||item.recipientId===current.id||Boolean(inChannel)||(current.role==="ADMIN"&&(item.teamId||item.departmentId));if(!allowed)return NextResponse.json({error:"NOT_FOUND"},{status:404});
 const root=path.join(process.cwd(),"storage","chat");const target=path.resolve(root,item.attachmentPath);if(!target.startsWith(path.resolve(root)+path.sep))return NextResponse.json({error:"NOT_FOUND"},{status:404});
 try{
  const data=await readFile(target);const download=new URL(request.url).searchParams.get("download")==="1";const range=request.headers.get("range");
  const common={"Content-Type":item.attachmentMime,"Content-Disposition":`${download?"attachment":"inline"}; filename*=UTF-8''${encodeURIComponent(item.attachmentName)}`,"Cache-Control":"private, max-age=3600","Accept-Ranges":"bytes"};
  if(range&&!download){const match=/bytes=(\d*)-(\d*)/.exec(range);const start=match?.[1]?Number(match[1]):0;const end=match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;if(start> end||start>=data.length)return new Response(null,{status:416,headers:{"Content-Range":`bytes */${data.length}`}});const chunk=data.subarray(start,end+1);return new Response(chunk,{status:206,headers:{...common,"Content-Length":String(chunk.length),"Content-Range":`bytes ${start}-${end}/${data.length}`}})}
  return new Response(data,{headers:{...common,"Content-Length":String(data.length)}})
 }catch{return NextResponse.json({error:"NOT_FOUND"},{status:404})}
}
