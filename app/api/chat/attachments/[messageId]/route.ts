import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { currentAccessUser } from "../../../../../lib/auth/module-access";

export async function GET(request:Request,{params}:{params:Promise<{messageId:string}>}){
 const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});const{messageId}=await params;
 const item=await prisma.chatMessage.findFirst({where:{id:messageId,hotelTenantId:current.hotel_tenant_id,attachmentPath:{not:null},OR:[{senderId:current.id},{recipientId:current.id}]},select:{attachmentPath:true,attachmentName:true,attachmentMime:true}});if(!item?.attachmentPath||!item.attachmentName||!item.attachmentMime)return NextResponse.json({error:"NOT_FOUND"},{status:404});
 const root=path.join(process.cwd(),"storage","chat");const target=path.resolve(root,item.attachmentPath);if(!target.startsWith(path.resolve(root)+path.sep))return NextResponse.json({error:"NOT_FOUND"},{status:404});
 try{
  const data=await readFile(target);const download=new URL(request.url).searchParams.get("download")==="1";const range=request.headers.get("range");
  const common={"Content-Type":item.attachmentMime,"Content-Disposition":`${download?"attachment":"inline"}; filename*=UTF-8''${encodeURIComponent(item.attachmentName)}`,"Cache-Control":"private, max-age=3600","Accept-Ranges":"bytes"};
  if(range&&!download){const match=/bytes=(\d*)-(\d*)/.exec(range);const start=match?.[1]?Number(match[1]):0;const end=match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;if(start> end||start>=data.length)return new Response(null,{status:416,headers:{"Content-Range":`bytes */${data.length}`}});const chunk=data.subarray(start,end+1);return new Response(chunk,{status:206,headers:{...common,"Content-Length":String(chunk.length),"Content-Range":`bytes ${start}-${end}/${data.length}`}})}
  return new Response(data,{headers:{...common,"Content-Length":String(data.length)}})
 }catch{return NextResponse.json({error:"NOT_FOUND"},{status:404})}
}
