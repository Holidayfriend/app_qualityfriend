import { NextResponse } from "next/server";
import {
  getMcpConversationFiles,
  getMcpConversations,
  getMcpMostUsedPrompts,
  getMcpPrompt,
  getMcpServerTools,
  getMcpServers,
  getMcpSuggestions,
  getMcpUserPreferences,
  getMcpVectorStores,
  McpApiError,
} from "@/lib/mcp/client";
import {
  normalizeChatFiles,
  normalizeConversations,
  normalizeMostUsedPrompts,
  normalizeSuggestions,
  normalizeTools,
  normalizeVectorStores,
  providerPreferences,
  serverCategory,
  type ChatToolGroup,
} from "@/lib/mcp/chat-data";
import { normalizePrompt, object, rows } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

function text(value: unknown) { return typeof value === "string" ? value : ""; }

export async function GET(request: Request) {
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const url = new URL(request.url);
    const promptId = (url.searchParams.get("promptId") || "").slice(0, 160);
    const conversationId = (url.searchParams.get("conversationId") || "").slice(0, 160);
    const profile = object(context.profile);
    const hotel = object(profile.hotel);
    const hotelId = text(profile.hotelId) || text(hotel.id);

    const [suggestionsPayload, promptsPayload, conversationsPayload, preferencesPayload, serversPayload, storesPayload, promptPayload, filesPayload] = await Promise.all([
      getMcpSuggestions(context.token, 8).catch(() => ({ suggestions: [] })),
      getMcpMostUsedPrompts(context.token, 4).catch(() => ({ prompts: [] })),
      getMcpConversations(context.token).catch(() => []),
      getMcpUserPreferences(context.token).catch(() => ({})),
      getMcpServers(context.token).catch(() => []),
      hotelId ? getMcpVectorStores(context.token, hotelId).catch(() => ({ vectorStores: [] })) : Promise.resolve({ vectorStores: [] }),
      promptId ? getMcpPrompt(context.token, promptId).catch(() => null) : Promise.resolve(null),
      conversationId ? getMcpConversationFiles(context.token, conversationId).catch(() => ({ files: [] })) : Promise.resolve({ files: [] }),
    ]);

    const serverRows = rows(serversPayload, ["servers", "data"]);
    const groups = await Promise.all(serverRows.flatMap((entry) => {
      const server = object(entry), category = serverCategory(server), serverId = text(server.id);
      if (!category || !serverId || server.isActive === false) return [];
      return [getMcpServerTools(context.token, serverId)
        .then((tools): ChatToolGroup => ({ category, serverId, tools: normalizeTools(tools) }))
        .catch((): ChatToolGroup => ({ category, serverId, tools: [] }))];
    }));
    const preferencesRoot = object(preferencesPayload);

    return NextResponse.json({
      suggestions: normalizeSuggestions(suggestionsPayload),
      mostUsedPrompts: normalizeMostUsedPrompts(promptsPayload),
      conversations: normalizeConversations(conversationsPayload).filter((conversation) => !conversation.archived),
      preferences: providerPreferences(preferencesRoot.userPrefs ?? preferencesRoot),
      toolGroups: groups,
      vectorStores: normalizeVectorStores(storesPayload),
      selectedPrompt: normalizePrompt(promptPayload),
      files: normalizeChatFiles(filesPayload),
      account: { email: text(profile.email), role: text(profile.role), hotelId },
    });
  } catch (error) {
    console.error("MCP chat bootstrap could not be loaded.", error);
    return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : "MCP chat could not be loaded." }, { status: 502 });
  }
}
