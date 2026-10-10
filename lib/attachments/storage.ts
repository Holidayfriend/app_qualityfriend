import "server-only";

import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type AttachmentScope = "handovers" | "checklists";

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const KEY = /^[0-9a-f-]{36}\.(png|jpe?g|webp|gif)$/i;

type UploadLike = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

function rootFor(scope: AttachmentScope) {
  return path.join(process.cwd(), "storage", scope);
}

export function isAttachmentUpload(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value && "size" in value && Number((value as File).size) > 0);
}

function extensionFor(file: UploadLike) {
  const fromType = TYPES.get(file.type);
  if (fromType) return fromType;
  const match = /\.(png|jpe?g|webp|gif)$/i.exec(file.name);
  if (!match) return null;
  return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
}

export async function saveAttachmentFile(scope: AttachmentScope, file: UploadLike) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0 || file.size > MAX_BYTES) return null;
  const ext = extensionFor(file);
  if (!ext) return null;
  const storageKey = `${randomUUID()}.${ext}`;
  const root = rootFor(scope);
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
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
}

export async function readAttachmentFile(scope: AttachmentScope, storageKey: string) {
  if (!KEY.test(storageKey)) return null;
  const root = path.resolve(rootFor(scope));
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return null;
  try { return await readFile(target); } catch { return null; }
}

export async function copyAttachmentFile(scope: AttachmentScope, storageKey: string) {
  if (!KEY.test(storageKey)) return null;
  const root = path.resolve(rootFor(scope));
  const source = path.resolve(root, storageKey);
  if (!source.startsWith(root + path.sep)) return null;
  const ext = storageKey.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  const nextKey = `${randomUUID()}.${ext}`;
  await mkdir(root, { recursive: true });
  try { await copyFile(source, path.join(root, nextKey)); return nextKey; } catch { return null; }
}

export async function deleteAttachmentFile(scope: AttachmentScope, storageKey: string) {
  if (!KEY.test(storageKey)) return;
  const root = path.resolve(rootFor(scope));
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return;
  await unlink(target).catch(() => undefined);
}
