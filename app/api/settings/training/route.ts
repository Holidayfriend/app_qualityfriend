import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/session";
import { loginMcpUser } from "../../../../lib/mcp/client";
import { prisma } from "../../../../lib/prisma";

const baseUrl = () => (process.env.MCP_API_BASE_URL || "https://apis.qualityfriend.solutions").replace(/\/$/, "");
const filesPath = () => process.env.MCP_FINE_TUNING_FILES_PATH || "/openai/fine-tuning/files";

async function mcpContext() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { hotelTenant: { select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true } } } });
  const hotel = user?.hotelTenant;
  if (!hotel?.activeMcp || !hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword) return { unavailable: true } as const;
  return { hotelId: hotel.mcpHotelId, token: await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword) };
}

function endpoint(hotelId: string) {
  const path = filesPath(), separator = path.includes("?") ? "&" : "?";
  return `${baseUrl()}${path}${separator}hotelId=${encodeURIComponent(hotelId)}`;
}

async function relay(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) return NextResponse.json({ error: "MCP_TRAINING_REQUEST_FAILED", message: payload?.message || payload?.error || "The MCP training service request failed." }, { status: response.status });
  return NextResponse.json(payload ?? {});
}

export async function GET() {
  try {
    const auth = await mcpContext();
    if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 });
    return relay(await fetch(endpoint(auth.hotelId), { headers: { Authorization: `Bearer ${auth.token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }));
  } catch (error) {
    return NextResponse.json({ error: "MCP_TRAINING_UNAVAILABLE", message: error instanceof Error ? error.message : "The MCP training service could not be reached." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await mcpContext();
    if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 });
    const input = await request.formData();
    const files = input.getAll("files").filter((entry): entry is File => entry instanceof File);
    if (!files.length || files.some((file) => !/\.(json|jsonl)$/i.test(file.name))) return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
    const form = new FormData();
    files.forEach((file) => form.append("files", file, file.name));
    form.set("purpose", "fine-tune"); form.set("hotelId", auth.hotelId);
    return relay(await fetch(endpoint(auth.hotelId), { method: "POST", headers: { Authorization: `Bearer ${auth.token}` }, body: form, cache: "no-store", signal: AbortSignal.timeout(60_000) }));
  } catch (error) {
    return NextResponse.json({ error: "MCP_TRAINING_UNAVAILABLE", message: error instanceof Error ? error.message : "The MCP training service could not be reached." }, { status: 502 });
  }
}
