import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../lib/auth/module-access";
import { chatDirectory } from "../../../lib/chat/directory";

export async function GET() {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json(await chatDirectory(current.id, current.hotel_tenant_id, current.role));
}
