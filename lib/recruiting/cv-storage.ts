import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

const storageRoot = () => path.join(process.cwd(), "storage", "recruiting-cvs");

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

export function cvMime(storageKey: string) {
  const ext = storageKey.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

function extensionFor(file: File) {
  const fromType = ALLOWED.get(file.type);
  if (fromType) return fromType;
  const match = /\.(pdf|doc|docx)$/i.exec(file.name);
  return match ? match[1].toLowerCase() : null;
}

export async function saveRecruitingCv(file: File) {
  if (!(file instanceof File) || file.size <= 0 || file.size > MAX_BYTES) return null;
  const ext = extensionFor(file);
  if (!ext) return null;
  const storageKey = `${randomUUID()}.${ext}`;
  const directory = storageRoot();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storageKey), Buffer.from(await file.arrayBuffer()));
  return { storageKey, originalName: file.name.trim().slice(0, 180) || storageKey };
}

export async function readRecruitingCv(storageKey: string) {
  if (!/^[0-9a-f-]{36}\.(pdf|doc|docx)$/i.test(storageKey)) return null;
  const root = path.resolve(storageRoot());
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}
