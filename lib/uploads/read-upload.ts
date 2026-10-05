import { readFile } from "node:fs/promises";
import path from "node:path";

const folders = new Set(["recruiting-jobs", "hotel-logos"]);
const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
const filenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i;

export async function readPublicUpload(folder: string, filename: string) {
  if (!folders.has(folder) || !filenamePattern.test(filename)) return null;
  try {
    const body = await readFile(path.join(process.cwd(), "public", "uploads", folder, filename));
    const extension = filename.split(".").pop()?.toLowerCase() ?? "";
    return { body, type: types[extension] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
