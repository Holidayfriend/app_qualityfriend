import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const storageRoot = () => path.join(process.cwd(), "storage", "notes");
const KEY = /^[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g|webp|gif)$/i;

type UploadLike = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

export function isNoteUpload(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value && "size" in value && Number((value as File).size) > 0);
}

function extensionFor(file: UploadLike) {
  const fromType = TYPES.get(file.type);
  if (fromType) return fromType;
  const match = /\.(pdf|doc|docx|png|jpe?g|webp|gif)$/i.exec(file.name);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

export async function saveNoteFile(file: UploadLike) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0 || file.size > MAX_BYTES) return null;
  const ext = extensionFor(file);
  if (!ext) return null;
  const storageKey = `${randomUUID()}.${ext}`;
  const root = storageRoot();
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, storageKey), Buffer.from(await file.arrayBuffer()));
  return {
    storageKey,
    originalName: String(file.name || "").trim().slice(0, 180) || storageKey,
    mimeType: TYPES.has(file.type) ? file.type : mimeFor(storageKey),
    byteSize: file.size,
  };
}

export function mimeFor(storageKey: string) {
  const ext = storageKey.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
}

export async function readNoteFile(storageKey: string) {
  if (!KEY.test(storageKey)) return null;
  const root = path.resolve(storageRoot());
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

export async function deleteNoteFile(storageKey: string) {
  if (!KEY.test(storageKey)) return;
  const root = path.resolve(storageRoot());
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return;
  await unlink(target).catch(() => undefined);
}

const HOTEL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i;
const inlineRoot = () => path.join(process.cwd(), "storage", "notes-inline");

export function noteImageExtension(type: string, name = "") {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  const match = /\.(png|jpe?g|webp|gif)$/i.exec(name);
  if (!match) return null;
  return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
}

let inlineTableReady: Promise<void> | null = null;

async function ensureInlineTable() {
  inlineTableReady ??= import("../prisma").then(({ prisma }) => prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "note_inline_images" (
      "hotel_tenant_id" UUID NOT NULL,
      "storage_key" VARCHAR(80) NOT NULL,
      "bytes" BYTEA NOT NULL,
      "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "note_inline_images_pkey" PRIMARY KEY ("hotel_tenant_id", "storage_key")
    )
  `).then(() => undefined));
  return inlineTableReady;
}

async function writeInlineDatabase(hotelTenantId: string, storageKey: string, bytes: Buffer) {
  await ensureInlineTable();
  const { prisma } = await import("../prisma");
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  await prisma.$executeRaw`
    INSERT INTO "note_inline_images" ("hotel_tenant_id", "storage_key", "bytes")
    VALUES (${hotelTenantId}::uuid, ${storageKey}, ${payload})
    ON CONFLICT ("hotel_tenant_id", "storage_key") DO UPDATE SET "bytes" = EXCLUDED."bytes"
  `;
}

async function readInlineDatabase(hotelTenantId: string, storageKey: string) {
  await ensureInlineTable();
  const { prisma } = await import("../prisma");
  const rows = await prisma.$queryRaw<Array<{ bytes: Uint8Array }>>`
    SELECT "bytes" FROM "note_inline_images"
    WHERE "hotel_tenant_id" = ${hotelTenantId}::uuid AND "storage_key" = ${storageKey}
  `;
  const bytes = rows[0]?.bytes;
  return bytes?.byteLength ? Buffer.from(bytes) : null;
}

export async function saveInlineNoteImage(hotelTenantId: string, bytes: Buffer, ext: string) {
  const safeExt = ext === "jpeg" ? "jpg" : ext;
  if (!HOTEL_ID.test(hotelTenantId) || !["png", "jpg", "gif", "webp"].includes(safeExt)) return null;
  if (bytes.length <= 0 || bytes.length > MAX_BYTES) return null;
  const storageKey = `${randomUUID()}.${safeExt}`;
  await writeInlineDatabase(hotelTenantId, storageKey, bytes);
  const dir = path.join(inlineRoot(), hotelTenantId);
  await mkdir(dir, { recursive: true }).catch(() => undefined);
  await writeFile(path.join(dir, storageKey), bytes).catch(() => undefined);
  return `/api/notes/images/${storageKey}`;
}

export async function readInlineNoteImage(hotelTenantId: string, storageKey: string) {
  if (!HOTEL_ID.test(hotelTenantId) || !IMAGE_KEY.test(storageKey)) return null;
  const stored = await readInlineDatabase(hotelTenantId, storageKey).catch(() => null);
  if (stored) return stored;
  const root = path.resolve(inlineRoot(), hotelTenantId);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return null;
  try {
    const bytes = await readFile(target);
    await writeInlineDatabase(hotelTenantId, storageKey, bytes).catch(() => undefined);
    return bytes;
  } catch {
    return null;
  }
}
