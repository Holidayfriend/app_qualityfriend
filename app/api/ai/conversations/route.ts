import { NextResponse } from "next/server";
import { loadAssistantConversation, sendAssistantMessage } from "@/lib/ai/conversations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const assistant = new URL(request.url).searchParams.get("assistant");
  const result = await loadAssistantConversation(assistant);
  if ("error" in result) {
    const status = result.error === "UNAUTHENTICATED" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await sendAssistantMessage(body?.assistant, body?.message, body?.locale);
  if ("error" in result && "status" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
