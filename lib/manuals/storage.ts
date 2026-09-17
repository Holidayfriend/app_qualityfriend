import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["text/plain", "txt"],
]);
const KEY = /^[0-9a-f-]{36}\.(pdf|doc|docx|txt)$/i;
const storageRoot = () => path.join(process.cwd(), "storage", "manuals");

type UploadLike = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

export function isManualUpload(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value && "size" in value && Number((value as File).size) > 0);
}

function extensionFor(file: UploadLike) {
  const fromType = TYPES.get(file.type);
  if (fromType) return fromType;
  const match = /\.(pdf|doc|docx|txt)$/i.exec(file.name);
  return match ? match[1].toLowerCase() : null;
}

export async function saveManualFile(file: UploadLike) {
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
  if (ext === "txt") return "text/plain";
  return "application/octet-stream";
}

export async function readManualFile(storageKey: string) {
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

export async function deleteManualFile(storageKey: string) {
  if (!KEY.test(storageKey)) return;
  const root = path.resolve(storageRoot());
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return;
  await unlink(target).catch(() => undefined);
}
