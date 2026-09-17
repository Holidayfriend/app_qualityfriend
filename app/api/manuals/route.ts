import { NextResponse } from "next/server";
import { accessibleModules, currentAccessUser } from "../../../lib/auth/module-access";
import { loginMcpUser } from "../../../lib/mcp/client";
import { prisma } from "../../../lib/prisma";

const baseUrl = () => (process.env.MCP_API_BASE_URL || "https://apis.qualityfriend.solutions").replace(/\/$/, "");

type StoreRecord = { id?: string; name?: string; department?: { id?: string; name?: string } };
type FileRecord = { id?: string; filename?: string; name?: string; status?: string; createdAt?: string; updatedAt?: string; created_at?: string; updated_at?: string; attributes?: { title?: string } };

function storeIcon(name: string) {
  const text = name.toLowerCase();
  if (/hotel|weit|wide|tutto/.test(text)) return "📚";
  if (/recep|front/.test(text)) return "🏨";
  if (/house|reinig/.test(text)) return "🧹";
  if (/restau|service|ristor/.test(text)) return "🍽️";
  if (/küche|kuche|kitchen|cucina/.test(text)) return "👨‍🍳";
  if (/admin/.test(text)) return "👤";
  if (/market/.test(text)) return "📣";
  return "📖";
}

function fileStatus(value?: string) {
  const status = (value || "").toLowerCase();
  if (/(outdated|veraltet|fail|error)/.test(status)) return "outdated";
  if (/(review|pruefen|prüfen|pending|process|in_progress)/.test(status)) return "review";
  return "current";
}

function fileUpdated(file: FileRecord) {
  return file.updatedAt || file.updated_at || file.createdAt || file.created_at || "";
}

async function payload(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.details || data?.message || data?.error || "MCP manuals request failed.");
  return data;
}

export async function GET() {
  try {
    const user = await currentAccessUser();
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (user.role !== "ADMIN" && !(await accessibleModules(user)).includes("manuals")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { hotelTenant: { select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true } } } });
    const hotel = account?.hotelTenant;
    const canUpload = user.role === "ADMIN" || user.role === "MANAGEMENT";
    if (!hotel?.activeMcp || !hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword) {
      return NextResponse.json({ stores: [], canUpload, mcpActive: false });
    }
    const token = await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword);
    const rawStores = await fetch(`${baseUrl()}/rag/vector-stores?hotelId=${encodeURIComponent(hotel.mcpHotelId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }).then(payload);
    const stores: StoreRecord[] = Array.isArray(rawStores) ? rawStores : rawStores?.vectorStores ?? rawStores?.data ?? [];
    const mapped = await Promise.all(stores.map(async (store) => {
      const id = String(store.id || "");
      const name = String(store.name || store.department?.name || "Knowledge base");
      let files: FileRecord[] = [];
      if (id) {
        try {
          const result = await fetch(`${baseUrl()}/rag/vector-stores/${encodeURIComponent(id)}/files?limit=50&hotelId=${encodeURIComponent(hotel.mcpHotelId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }).then(payload);
          files = Array.isArray(result) ? result : result?.data ?? result?.files ?? [];
        } catch { files = []; }
      }
      return {
        id: id || name,
        name,
        icon: storeIcon(`${name} ${store.department?.name || ""}`),
        docs: files.map((file, index) => ({
          id: String(file.id || `${id}-${index}`),
          name: file.attributes?.title || file.filename || file.name || "Document",
          updated: fileUpdated(file),
          status: fileStatus(file.status),
        })),
      };
    }));
    return NextResponse.json({ stores: mapped, canUpload, mcpActive: true });
  } catch (error) {
    return NextResponse.json({ error: "MANUALS_LOAD_FAILED", message: error instanceof Error ? error.message : "Manuals could not be loaded." }, { status: 502 });
  }
}
