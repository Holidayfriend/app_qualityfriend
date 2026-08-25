import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { queryDatabase } from "../../../../database";
import { currentAccessUser } from "../../../../lib/auth/module-access";

const maxSize=25*1024*1024;
function messageType(mime:string){if(mime.startsWith("image/"))return"IMAGE";if(mime.startsWith("video/"))return"VIDEO";if(mime.startsWith("audio/"))return"VOICE";return"DOCUMENT"}
async function recipient(id:string,hotelId:string){const r=await queryDatabase<{id:string}>(`SELECT id FROM users WHERE id=$1 AND hotel_tenant_id=$2 AND is_active=true AND is_deleted=false LIMIT 1`,[id,hotelId]);return r.rows[0]}

export async function GET(request:Request,{params}:{params:Promise<{userId:string}>}) {
  const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  const{userId}=await params;if(!await recipient(userId,current.hotel_tenant_id))return NextResponse.json({error:"NOT_FOUND"},{status:404});
  await queryDatabase(`UPDATE chat_messages SET read_at=NOW() WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL`,[userId,current.id]);
  const before=new URL(request.url).searchParams.get("before");
  const messages=await queryDatabase(`SELECT * FROM (SELECT id,sender_id,recipient_id,type,text,attachment_name,attachment_mime,attachment_size,read_at,created_at FROM chat_messages WHERE hotel_tenant_id=$1 AND ((sender_id=$2 AND recipient_id=$3) OR (sender_id=$3 AND recipient_id=$2)) AND ($4::timestamptz IS NULL OR created_at < $4::timestamptz) ORDER BY created_at DESC LIMIT 30) recent_messages ORDER BY created_at ASC`,[current.hotel_tenant_id,current.id,userId,before]);
  return NextResponse.json({messages:messages.rows,hasMore:messages.rows.length===30});
}

export async function POST(request:Request,{params}:{params:Promise<{userId:string}>}) {
  const current=await currentAccessUser();if(!current)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  const{userId}=await params;if(!await recipient(userId,current.hotel_tenant_id))return NextResponse.json({error:"NOT_FOUND"},{status:404});
  const form=await request.formData();const text=String(form.get("text")??"").trim();const attachment=form.get("attachment");let fileData:{path:string;name:string;mime:string;size:number;type:string}|null=null;
  if(attachment instanceof File&&attachment.size){if(attachment.size>maxSize)return NextResponse.json({error:"FILE_TOO_LARGE"},{status:400});const directory=path.join(process.cwd(),"storage","chat",current.hotel_tenant_id);await mkdir(directory,{recursive:true});const safeName=attachment.name.replace(/[^a-zA-Z0-9._-]/g,"_");const filename=`${randomUUID()}-${safeName}`;await writeFile(path.join(directory,filename),Buffer.from(await attachment.arrayBuffer()));fileData={path:path.join(current.hotel_tenant_id,filename),name:attachment.name,mime:attachment.type||"application/octet-stream",size:attachment.size,type:messageType(attachment.type)};}
  if(!text&&!fileData)return NextResponse.json({error:"EMPTY_MESSAGE"},{status:400});
  const result=await queryDatabase(`INSERT INTO chat_messages(hotel_tenant_id,sender_id,recipient_id,type,text,attachment_path,attachment_name,attachment_mime,attachment_size) VALUES($1,$2,$3,$4::"ChatMessageType",$5,$6,$7,$8,$9) RETURNING id,sender_id,recipient_id,type,text,attachment_name,attachment_mime,attachment_size,read_at,created_at`,[current.hotel_tenant_id,current.id,userId,fileData?.type??"TEXT",text||null,fileData?.path??null,fileData?.name??null,fileData?.mime??null,fileData?.size??null]);
  return NextResponse.json({message:result.rows[0]},{status:201});
}
