import { readPublicUpload } from "../../../../../lib/uploads/read-upload";

type Context = { params: Promise<{ folder: string; filename: string }> };

export async function GET(_request: Request, context: Context) {
  const { folder, filename } = await context.params;
  const file = await readPublicUpload(folder, filename);
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=86400" },
  });
}
