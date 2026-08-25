import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { queryDatabase } from "../../../../../database";
import { currentAccessUser } from "../../../../../lib/auth/module-access";

export async function GET(request:Request,{params}:{params:Promise<{messageId:string}>}){
 const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});const{messageId}=await params;
 const result=await queryDatabase<{attachment_path:string;attachment_name:string;attachment_mime:string}>(`SELECT attachment_path,attachment_name,attachment_mime FROM chat_messages WHERE id=$1 AND hotel_tenant_id=$2 AND (sender_id=$3 OR recipient_id=$3) AND attachment_path IS NOT NULL LIMIT 1`,[messageId,current.hotel_tenant_id,current.id]);const item=result.rows[0];if(!item)return NextResponse.json({error:"NOT_FOUND"},{status:404});
 const root=path.join(process.cwd(),"storage","chat");const target=path.resolve(root,item.attachment_path);if(!target.startsWith(path.resolve(root)+path.sep))return NextResponse.json({error:"NOT_FOUND"},{status:404});
 try{
  const data=await readFile(target);const download=new URL(request.url).searchParams.get("download")==="1";const range=request.headers.get("range");
  const common={"Content-Type":item.attachment_mime,"Content-Disposition":`${download?"attachment":"inline"}; filename*=UTF-8''${encodeURIComponent(item.attachment_name)}`,"Cache-Control":"private, max-age=3600","Accept-Ranges":"bytes"};
  if(range&&!download){const match=/bytes=(\d*)-(\d*)/.exec(range);const start=match?.[1]?Number(match[1]):0;const end=match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;if(start> end||start>=data.length)return new Response(null,{status:416,headers:{"Content-Range":`bytes */${data.length}`}});const chunk=data.subarray(start,end+1);return new Response(chunk,{status:206,headers:{...common,"Content-Length":String(chunk.length),"Content-Range":`bytes ${start}-${end}/${data.length}`}})}
  return new Response(data,{headers:{...common,"Content-Length":String(data.length)}})
 }catch{return NextResponse.json({error:"NOT_FOUND"},{status:404})}
}
