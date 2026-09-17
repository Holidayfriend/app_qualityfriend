import { randomUUID } from "node:crypto";

const CHUNK = 900;
const OVERLAP = 120;

export function splitManualText(text: string) {
  const normalized = text.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const chunks: { id: string; chunkIndex: number; content: string }[] = [];
  let start = 0;
  let index = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + CHUNK);
    const slice = normalized.slice(start, end).trim();
    if (slice) chunks.push({ id: randomUUID(), chunkIndex: index, content: slice });
    if (end >= normalized.length) break;
    start = Math.max(end - OVERLAP, start + 1);
    index += 1;
  }
  return chunks;
}
