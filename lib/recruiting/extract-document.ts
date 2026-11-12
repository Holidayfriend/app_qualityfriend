import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mammoth from "mammoth";
import type { ParseParameters } from "pdf-parse";
import { readableDocumentText } from "./cv-read";

type PdfParser = {
  getText: (params?: ParseParameters) => Promise<{ text?: string; pages?: { text?: string }[] }>;
  destroy: () => Promise<void>;
};

type PdfParseConstructor = {
  new (options: { data: Uint8Array }): PdfParser;
  setWorker: (workerSrc: string) => string;
};

const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<{ WorkerMessageHandler?: unknown }>;

function workerFile() {
  const root = process.cwd();
  const candidates = [
    path.join(root, "node_modules", "pdf-parse", "dist", "pdf-parse", "cjs", "pdf.worker.mjs"),
    path.join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
  ];
  const found = candidates.find((file) => existsSync(file));
  if (!found) throw new Error("PDF worker file is missing");
  return found;
}

let workerReady: Promise<void> | undefined;

function ensurePdfWorker() {
  workerReady ??= (async () => {
    const file = workerFile();
    const worker = await nativeImport(pathToFileURL(file).href);
    if (!worker.WorkerMessageHandler) throw new Error("PDF worker did not load");
    (globalThis as { pdfjsWorker?: { WorkerMessageHandler: unknown } }).pdfjsWorker = {
      WorkerMessageHandler: worker.WorkerMessageHandler,
    };
    const { PDFParse } = nodeRequire("pdf-parse") as { PDFParse: PdfParseConstructor };
    PDFParse.setWorker(pathToFileURL(file).href);
  })().catch((error: unknown) => {
    workerReady = undefined;
    throw error;
  });
  return workerReady;
}

function loadPdfParse() {
  return (nodeRequire("pdf-parse") as { PDFParse: PdfParseConstructor }).PDFParse;
}

async function extractPdfText(buffer: Buffer) {
  await ensurePdfWorker();
  const parser = new (loadPdfParse())({ data: new Uint8Array(buffer) });
  try {
    const attempts: ParseParameters[] = [
      { pageJoiner: "" },
      { pageJoiner: "", disableNormalization: true },
      { pageJoiner: "", disableNormalization: true, includeMarkedContent: true, lineEnforce: false },
    ];
    let lastError: unknown;
    for (const params of attempts) {
      try {
        const parsed = await parser.getText(params);
        const combined = [parsed.text, ...(parsed.pages ?? []).map((page) => page.text)].join("\n");
        const text = readableDocumentText(combined);
        if (text) return text;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) console.error("Recruiting document text extraction failed", lastError);
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
