import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { queryDatabase } from "../../../../../database";
import { getSessionUserId } from "../../../../../lib/auth/session";

const imageTypes = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"], ["image/gif", "gif"]]);

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const actor = await queryDatabase<{ role: string }>(`SELECT role FROM users WHERE id=$1 AND is_active=true AND is_deleted=false LIMIT 1`, [userId]);
  if (actor.rows[0]?.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const logo = (await request.formData()).get("logo");
  if (!(logo instanceof File) || !imageTypes.has(logo.type) || logo.size === 0 || logo.size > 5 * 1024 * 1024) return NextResponse.json({ error: "INVALID_LOGO" }, { status: 400 });
  const directory = path.join(process.cwd(), "public", "uploads", "hotel-logos");
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${imageTypes.get(logo.type)}`;
  await writeFile(path.join(directory, filename), Buffer.from(await logo.arrayBuffer()));
  return NextResponse.json({ logoUrl: `/uploads/hotel-logos/${filename}` });
}
