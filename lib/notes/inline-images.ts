import { saveInlineNoteImage } from "./storage";

const DATA_IMAGE = /<img\b[^>]*?\ssrc\s*=\s*(["'])data:image\/(png|jpe?g|gif|webp);base64,([^"']+)\1/gi;
const BROKEN_DATA_IMAGE = /<img\b[^>]*\ssrc\s*=\s*["']data:image\/[^"']*$/gi;
const MAX_BASE64 = Math.ceil((8 * 1024 * 1024) / 3) * 4;

type ImageExt = "png" | "jpg" | "gif" | "webp";

function imageExt(value: string): ImageExt {
  const ext = value.toLowerCase();
  if (ext === "jpeg" || ext === "jpg") return "jpg";
  if (ext === "gif") return "gif";
  if (ext === "webp") return "webp";
  return "png";
}

export function stripBrokenDataImages(html: string) {
  return html.replace(BROKEN_DATA_IMAGE, "");
}

export async function materializeNoteImages(
  html: string,
  save: (bytes: Buffer, ext: ImageExt) => Promise<string | null>,
) {
  const matches = [...html.matchAll(DATA_IMAGE)];
  let next = html;
  for (const match of matches) {
    const payload = match[3].replace(/\s+/g, "");
    const ext = imageExt(match[2]);
    if (payload.length > MAX_BASE64) {
      next = next.replace(match[0], "");
      continue;
    }
    const bytes = Buffer.from(payload, "base64");
    const url = bytes.length ? await save(bytes, ext) : null;
    const quote = match[1];
    const from = `${quote}data:image/${match[2]};base64,${match[3]}${quote}`;
    next = next.replace(match[0], url ? match[0].replace(from, `${quote}${url}${quote}`) : "");
  }
  return stripBrokenDataImages(next);
}

export function materializeHotelNoteImages(hotelTenantId: string, html: string) {
  return materializeNoteImages(html, (bytes, ext) => saveInlineNoteImage(hotelTenantId, bytes, ext));
}
