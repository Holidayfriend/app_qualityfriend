export const ASA_FTP_BASE = "https://qualityfriend.solutions/ASA_ftp/";
const MAX_BYTES = 20 * 1024 * 1024;

type AsaName =
  | { ok: true; filename: string }
  | { ok: false; error: "ASA_XML_NAME_REQUIRED" | "INVALID_ASA_XML_NAME" };

export function resolveAsaName(name: string | null): AsaName {
  const base = name?.trim();
  if (!base) return { ok: false, error: "ASA_XML_NAME_REQUIRED" };
  if (base.length > 255 || /[\\/<>:"|?*\x00-\x1f\x7f]/.test(base) || base === "." || base === ".." || /[. ]$/.test(base)) {
    return { ok: false, error: "INVALID_ASA_XML_NAME" };
  }
  return { ok: true, filename: /\.xml$/i.test(base) ? base : `${base}.xml` };
}

function fileUrl(filename: string, base: string) {
  const root = base.endsWith("/") ? base : `${base}/`;
  return new URL(encodeURIComponent(filename), root).toString();
}

function declaredSize(response: Response) {
  const total = response.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
  if (total) return Number(total);
  const length = response.headers.get("content-length");
  return length ? Number(length) : 0;
}

async function probe(url: string) {
  const head = await fetch(url, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (head.status !== 405 && head.status !== 501) return head;
  return fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "error", signal: AbortSignal.timeout(20_000) });
}

export async function checkAsaFile(name: string | null, base = ASA_FTP_BASE) {
  const resolved = resolveAsaName(name);
  if (!resolved.ok) return resolved.error;
  try {
    const response = await probe(fileUrl(resolved.filename, base));
    if (response.status !== 200 && response.status !== 206) return "ASA_XML_NOT_FOUND";
    if (declaredSize(response) > MAX_BYTES) throw new Error("ASA XML exceeds 20 MB");
    return "READY";
  } catch (error) {
    if (error instanceof Error && error.message === "ASA XML exceeds 20 MB") throw error;
    return "ASA_XML_NOT_FOUND";
  }
}

export async function readAsaFile(name: string, base = ASA_FTP_BASE) {
  const resolved = resolveAsaName(name);
  if (!resolved.ok) throw new Error("ASA XML file unavailable");
  const response = await fetch(fileUrl(resolved.filename, base), { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !response.body) throw new Error("ASA XML file unavailable");
  if (declaredSize(response) > MAX_BYTES) throw new Error("ASA XML exceeds 20 MB");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("ASA XML exceeds 20 MB");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  const declaration = bytes.subarray(0, 200).toString("ascii");
  const encoding = declaration.match(/encoding=["']([^"']+)/i)?.[1] ?? "utf-8";
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}
