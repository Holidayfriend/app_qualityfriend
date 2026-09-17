import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractRecruitingDocumentText(buffer: Buffer, mimeType: string, fileName: string) {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();
      return String(parsed.text || "").trim();
    } finally {
      await parser.destroy();
    }
  }
  if (mime.includes("wordprocessingml") || name.endsWith(".docx")) {
    const parsed = await mammoth.extractRawText({ buffer });
    return String(parsed.value || "").trim();
  }
  if (mime.startsWith("text/") || name.endsWith(".txt")) {
    return buffer.toString("utf8").trim();
  }
  return "";
}
