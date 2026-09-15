import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { recruitingActor } from "../../../../../lib/recruiting/access";

const imageTypes = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"], ["image/gif", "gif"]]);

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const image = (await request.formData()).get("image");
  if (!(image instanceof File) || !imageTypes.has(image.type) || image.size === 0 || image.size > 5 * 1024 * 1024) {
    return Response.json({ error: "INVALID_IMAGE" }, { status: 400 });
  }
  const directory = path.join(process.cwd(), "public", "uploads", "recruiting-jobs");
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${imageTypes.get(image.type)}`;
  await writeFile(path.join(directory, filename), Buffer.from(await image.arrayBuffer()));
  return Response.json({ url: `/uploads/recruiting-jobs/${filename}` }, { status: 201 });
}
