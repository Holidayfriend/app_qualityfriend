import { NextResponse } from "next/server";
import { restoreDeletedItem, type RecyclableType } from "../../../../../../lib/recycle-bin/recycle-bin-service";

const allowedTypes = new Set<RecyclableType>(["department", "team", "user"]);

export async function PATCH(_request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!allowedTypes.has(type as RecyclableType)) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
  return restoreDeletedItem(type as RecyclableType, id);
}
