import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type { ParseParameters } from "pdf-parse";
import { readableDocumentText } from "./cv-read";

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const attempts: ParseParameters[] = [
      { pageJoiner: "" },
      { pageJoiner: "", disableNormalization: true },
      { pageJoiner: "", disableNormalization: true, includeMarkedContent: true, lineEnforce: false },
    ];
    for (const params of attempts) {
      const parsed = await parser.getText(params);
      const combined = [parsed.text, ...parsed.pages.map((page) => page.text)].join("\n");
      const text = readableDocumentText(combined);
      if (text) return text;
    }
    return "";
  } finally {
    await parser.destroy();
  }
}

export async function extractRecruitingDocumentText(buffer: Buffer, mimeType: string, fileName: string) {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  try {
    if (mime.includes("pdf") || name.endsWith(".pdf")) return await extractPdfText(buffer);
    if (mime.includes("wordprocessingml") || name.endsWith(".docx")) {
      const parsed = await mammoth.extractRawText({ buffer });
      return readableDocumentText(String(parsed.value || ""));
    }
    if (mime.startsWith("text/") || name.endsWith(".txt")) return readableDocumentText(buffer.toString("utf8"));
  } catch (error) {
    console.error("Recruiting document text extraction failed", error);
  }
  return "";
}
