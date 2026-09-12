import { realpath, stat } from "node:fs/promises";
import path from "node:path";

export async function checkAsaFile(name: string | null, directory = path.join(process.cwd(), "public", "ASA")) {
  const base = name?.trim();
  if (!base) return "ASA_XML_NAME_REQUIRED";
  if (base.length > 255 || /[\\/<>:"|?*\x00-\x1f\x7f]/.test(base) || base === "." || base === ".." || /[. ]$/.test(base)) return "INVALID_ASA_XML_NAME";
  const filename = /\.xml$/i.test(base) ? base : `${base}.xml`;
  try {
    const root = await realpath(directory);
    const target = await realpath(path.join(root, filename));
    const relative = path.relative(root, target);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) return "INVALID_ASA_XML_NAME";
    return (await stat(target)).isFile() ? "READY" : "ASA_XML_NOT_FOUND";
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return "ASA_XML_NOT_FOUND";
    throw error;
  }
}
