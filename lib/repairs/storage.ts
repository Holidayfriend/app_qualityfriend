import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
]);

const storageRoot = () => path.join(process.cwd(), "storage", "repairs");
const KEY = /^[0-9a-f-]{36}\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|m4a|wav|ogg)$/i;

type UploadLike = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

export function isRepairUpload(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value && "size" in value && Number((value as File).size) > 0);
}

function extensionFor(file: UploadLike) {
  const fromType = TYPES.get(file.type);
  if (fromType) return fromType;
  const match = /\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|m4a|wav|ogg)$/i.exec(file.name);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

export async function saveRepairFile(file: UploadLike) {
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
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  return "application/octet-stream";
}

export function kindFor(mimeType: string, name = "") {
  if (mimeType.startsWith("video") || /\.(mp4|webm|mov)$/i.test(name)) return "video" as const;
  if (mimeType.startsWith("audio") || /\.(mp3|m4a|wav|ogg)$/i.test(name)) return "voice" as const;
  return "photo" as const;
}

export async function readRepairFile(storageKey: string) {
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

export async function copyRepairStoredFile(storageKey: string) {
  if (!KEY.test(storageKey)) return null;
  const root = path.resolve(storageRoot());
  const source = path.resolve(root, storageKey);
  if (!source.startsWith(root + path.sep)) return null;
  const ext = storageKey.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  const nextKey = `${randomUUID()}.${ext}`;
  await mkdir(root, { recursive: true });
  try {
    await copyFile(source, path.join(root, nextKey));
    return nextKey;
  } catch {
    return null;
  }
}

export async function deleteRepairFile(storageKey: string) {
  if (!KEY.test(storageKey)) return;
  const root = path.resolve(storageRoot());
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return;
  await unlink(target).catch(() => undefined);
}
