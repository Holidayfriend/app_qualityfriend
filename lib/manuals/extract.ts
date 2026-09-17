import mammoth from "mammoth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const root = () => path.join(process.cwd(), "storage", "manuals");

export async function extractManualText(storageKey: string, mimeType: string) {
  const target = path.resolve(root(), storageKey);
  const allowed = path.resolve(root()) + path.sep;
  if (!target.startsWith(allowed)) throw new Error("Invalid storage key");
  const buffer = await readFile(target);
  const ext = storageKey.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || mimeType.includes("pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();
      return String(parsed.text || "").trim();
    } finally {
      await parser.destroy();
    }
  }
  if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    const parsed = await mammoth.extractRawText({ buffer });
    return String(parsed.value || "").trim();
  }
  if (ext === "txt" || mimeType.startsWith("text/")) {
    return buffer.toString("utf8").trim();
  }
  throw new Error("Unsupported manual format");
}
