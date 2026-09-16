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
