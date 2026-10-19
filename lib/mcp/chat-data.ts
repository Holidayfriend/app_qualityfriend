import { normalizePrompts, object, rows, type PortalPrompt } from "./prompt-data";

export type ChatConversation = { id: string; title: string; archived: boolean; createdAt: string; updatedAt: string; provider: string; model: string; promptId: string };
export type ChatMessage = { id: string; role: "user" | "assistant" | "tool"; content: string; provider: string; model: string; createdAt: string; reaction: "like" | "dislike" | "none" };
export type ChatSuggestion = { key: string; label: string; template: string; icon: string };
export type ChatTool = { name: string; title: string; description: string; inputSchema: Record<string, unknown> };
export type ChatToolGroup = { category: "Energy" | "Brevo" | "XML"; serverId: string; tools: ChatTool[] };
export type ChatVectorStore = { id: string; name: string };
export type ChatFile = { id: string; originalName: string; mimeType: string; size: number; path: string };

function string(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export function normalizeConversations(payload: unknown): ChatConversation[] {
  return rows(payload, ["conversations", "data"]).flatMap((entry) => {
    const item = object(entry), id = string(item.id);
    if (!id) return [];
    return [{ id, title: string(item.title), archived: item.archived === true, createdAt: string(item.createdAt), updatedAt: string(item.updatedAt), provider: string(item.provider), model: string(item.model), promptId: string(item.promptId) }];
  });
}

export function normalizeConversationMessages(payload: unknown) {
  const root = object(payload);
  const conversation = object(root.conversation);
  const messages: ChatMessage[] = rows(payload, ["messages", "data"]).flatMap((entry) => {
    const message = object(entry);
    const rawRole = string(message.role).toLowerCase();
    if (rawRole === "system") return [];
    const role: ChatMessage["role"] = rawRole === "user" ? "user" : rawRole === "tool" ? "tool" : "assistant";
    const feedback = object(message.feedback);
    const reaction = message.reaction === "like" || feedback.reaction === "like" ? "like" : message.reaction === "dislike" || feedback.reaction === "dislike" ? "dislike" : "none";
    return [{ id: string(message.id), role, content: string(message.content), provider: string(message.provider) || string(conversation.provider), model: string(message.model) || string(conversation.model), createdAt: string(message.createdAt), reaction }];
  });
  return { messages, conversation: { provider: string(conversation.provider), model: string(conversation.model) } };
}

export function normalizeSuggestions(payload: unknown): ChatSuggestion[] {
  return rows(payload, ["suggestions", "data"]).flatMap((entry, index) => {
    const suggestion = object(entry);
    const label = string(suggestion.label).trim();
    if (!label) return [];
    return [{ key: string(suggestion.key) || `suggestion-${index}`, label, template: string(suggestion.template), icon: string(suggestion.icon) }];
  });
}

export function normalizeMostUsedPrompts(payload: unknown): PortalPrompt[] { return normalizePrompts(payload); }

export function normalizeTools(payload: unknown): ChatTool[] {
  return rows(payload, ["tools", "data"]).flatMap((entry) => {
    const tool = object(entry);
    const name = string(tool.name).trim();
    if (!name) return [];
    const schema = object(tool.inputSchema);
    return [{ name, title: string(tool.title).trim() || name, description: string(tool.description), inputSchema: schema }];
  });
}

export function normalizeVectorStores(payload: unknown): ChatVectorStore[] {
  return rows(payload, ["vectorStores", "stores", "data"]).flatMap((entry) => {
    const store = object(entry), id = string(store.id), name = string(store.name).trim();
    return id && name && !name.includes("-default-store") ? [{ id, name }] : [];
  });
}

export function normalizeChatFiles(payload: unknown): ChatFile[] {
  return rows(payload, ["files", "data"]).flatMap((entry) => {
    const file = object(entry);
    const id = string(file.id) || string(file.fileId), originalName = string(file.originalName) || string(file.name);
    if (!id && !originalName) return [];
    return [{ id, originalName, mimeType: string(file.mimeType), size: Math.max(0, number(file.size)), path: string(file.path) || string(file.url) }];
  });
}

export function providerPreferences(payload: unknown) {
  const preferences = object(payload);
  const enabledProviders = Array.isArray(preferences.enabledProviders) ? preferences.enabledProviders.filter((item): item is string => typeof item === "string") : [];
  const models = object(preferences.models);
  return {
    enabledProviders,
    defaultProvider: string(preferences.defaultProvider) || enabledProviders[0] || "openai",
    models: Object.fromEntries(Object.entries(models).flatMap(([key, value]) => typeof value === "string" && value ? [[key, value]] : [])),
  };
}

export function serverCategory(value: unknown): ChatToolGroup["category"] | null {
  const server = object(value);
  const name = `${string(server.name)} ${string(server.command)} ${string(server.description)}`.toLowerCase();
  if (name.includes("energy")) return "Energy";
  if (name.includes("brevo")) return "Brevo";
  if (name.includes("xml")) return "XML";
  return null;
}
