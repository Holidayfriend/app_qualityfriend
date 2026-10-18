import { exportMcpPrompts, McpApiError } from "@/lib/mcp/client";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return Response.json({ error: context.error }, { status: context.status });
    if (context.profile.role !== "author") return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    const data = await exportMcpPrompts(context.token);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(data, {
      headers: {
        "Content-Type": "application/jsonl; charset=utf-8",
        "Content-Disposition": `attachment; filename="prompts_export_${day}.jsonl"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("MCP prompt export failed.", error);
    return Response.json({ error: error instanceof McpApiError ? error.message : "MCP prompt export failed." }, { status: 502 });
  }
}
