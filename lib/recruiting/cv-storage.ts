import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 8 * 1024 * 1024;

const DOC_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

const IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const ALL_TYPES = new Map([...DOC_TYPES, ...IMAGE_TYPES]);

const storageRoot = () => path.join(process.cwd(), "storage", "recruiting-cvs");
const extrasRoot = () => path.join(process.cwd(), "storage", "recruiting-files");

export function unpackCvRef(value: string): { storageKey: string | null; displayName: string } {
  const raw = value.trim();
  if (!raw) return { storageKey: null, displayName: "" };
  const sep = raw.indexOf("::");
  if (sep <= 0) return { storageKey: null, displayName: raw };
  const storageKey = raw.slice(0, sep).trim();
  const displayName = raw.slice(sep + 2).trim() || storageKey;
  if (!/^[0-9a-f-]{36}\.(pdf|doc|docx)$/i.test(storageKey)) {
    return { storageKey: null, displayName: raw };
  }
  return { storageKey, displayName };
}

export function packCvRef(storageKey: string, originalName: string) {
  const safeName = originalName.replace(/[\r\n]/g, " ").trim().slice(0, 180) || storageKey;
  return `${storageKey}::${safeName}`.slice(0, 255);
}

export function fileMime(storageKey: string) {
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

/** @deprecated use fileMime */
export function cvMime(storageKey: string) {
  return fileMime(storageKey);
}

type UploadLike = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

function extensionFor(file: UploadLike, allowImages: boolean) {
  const map = allowImages ? ALL_TYPES : DOC_TYPES;
  const fromType = map.get(file.type);
  if (fromType) return fromType;
  const pattern = allowImages
    ? /\.(pdf|doc|docx|png|jpe?g|webp|gif)$/i
    : /\.(pdf|doc|docx)$/i;
  const match = pattern.exec(file.name);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

async function saveFile(file: UploadLike, root: string, allowImages: boolean) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0 || file.size > MAX_BYTES) return null;
  const ext = extensionFor(file, allowImages);
  if (!ext) return null;
  const storageKey = `${randomUUID()}.${ext}`;
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, storageKey), Buffer.from(await file.arrayBuffer()));
  const mimeType = ALL_TYPES.has(file.type)
    ? file.type
    : fileMime(storageKey);
  return {
    storageKey,
    originalName: String(file.name || "").trim().slice(0, 180) || storageKey,
    mimeType,
  };
}

export async function saveRecruitingCv(file: UploadLike) {
  return saveFile(file, storageRoot(), false);
}

export async function saveRecruitingExtraFile(file: UploadLike) {
  return saveFile(file, extrasRoot(), true);
}

async function readFromRoot(rootDir: string, storageKey: string, pattern: RegExp) {
  if (!pattern.test(storageKey)) return null;
  const root = path.resolve(rootDir);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

export async function readRecruitingCv(storageKey: string) {
  return readFromRoot(storageRoot(), storageKey, /^[0-9a-f-]{36}\.(pdf|doc|docx)$/i);
}

export async function readRecruitingExtraFile(storageKey: string) {
  return readFromRoot(extrasRoot(), storageKey, /^[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g|webp|gif)$/i);
}

async function deleteFromRoot(rootDir: string, storageKey: string, pattern: RegExp) {
  if (!pattern.test(storageKey)) return false;
  const root = path.resolve(rootDir);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return false;
  try {
    await unlink(target);
    return true;
  } catch {
    return false;
  }
}

export async function deleteRecruitingCv(storageKey: string) {
  return deleteFromRoot(storageRoot(), storageKey, /^[0-9a-f-]{36}\.(pdf|doc|docx)$/i);
}

export async function deleteRecruitingExtraFile(storageKey: string) {
  return deleteFromRoot(extrasRoot(), storageKey, /^[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g|webp|gif)$/i);
}

export function extraFileDownloadUrl(applicationId: string, fileId: string) {
  return `/api/recruiting/applications/${applicationId}/files/${fileId}`;
}
