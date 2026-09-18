import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { AI_PROVIDERS, defaultModel, isAiProviderId, providerModels, type AiProviderId } from "./providers";
import { decryptAiSecret, encryptAiSecret } from "./secret";

type HotelAiDb = Pick<PrismaClient, "hotelAiSettings" | "hotelAiProviderCredential">;

export class HotelAiNotConfiguredError extends Error {
  constructor(message = "Hotel AI API key is not configured.") {
    super(message);
    this.name = "HotelAiNotConfiguredError";
  }
}

export async function ensureHotelAiTables() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "hotel_ai_settings" (
        "hotel_tenant_id" UUID NOT NULL,
        "active_provider" VARCHAR(40) NOT NULL DEFAULT 'openai',
        "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "hotel_ai_settings_pkey" PRIMARY KEY ("hotel_tenant_id")
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "hotel_ai_provider_credentials" (
        "id" UUID NOT NULL,
        "hotel_tenant_id" UUID NOT NULL,
        "provider" VARCHAR(40) NOT NULL,
        "model" VARCHAR(80) NOT NULL,
        "api_key_encrypted" TEXT NOT NULL DEFAULT '',
        "api_key_last4" VARCHAR(8) NOT NULL DEFAULT '',
        "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "hotel_ai_provider_credentials_pkey" PRIMARY KEY ("id")
      )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "hotel_ai_provider_credentials_hotel_tenant_id_provider_key" ON "hotel_ai_provider_credentials"("hotel_tenant_id", "provider")`);
  } finally {
    await pool.end();
  }
}

export async function listHotelAiProviders(prisma: HotelAiDb, hotelTenantId: string) {
  await ensureHotelAiTables();
  const [settings, credentials] = await Promise.all([
    prisma.hotelAiSettings.findUnique({ where: { hotelTenantId } }),
    prisma.hotelAiProviderCredential.findMany({ where: { hotelTenantId } }),
  ]);
  const byProvider = new Map(credentials.map((row) => [row.provider, row]));
  const activeProvider = isAiProviderId(settings?.activeProvider) ? settings.activeProvider : "openai";
  return {
    activeProvider,
    providers: (Object.keys(AI_PROVIDERS) as AiProviderId[]).map((id) => {
      const meta = AI_PROVIDERS[id];
      const row = byProvider.get(id);
      const models = providerModels(id);
      const model = row?.model && models.includes(row.model) ? row.model : defaultModel(id);
      return {
        id,
        name: meta.name,
        implemented: meta.implemented,
        models,
        model,
        hasKey: Boolean(row?.apiKeyEncrypted),
        last4: row?.apiKeyLast4 || "",
      };
    }),
  };
}

export async function saveHotelAiProvider(
  prisma: PrismaClient,
  hotelTenantId: string,
  input: { provider: AiProviderId; model?: string; apiKey?: string; clearKey?: boolean; activeProvider?: AiProviderId },
) {
  await ensureHotelAiTables();
  const models = providerModels(input.provider);
  const model = input.model && models.includes(input.model) ? input.model : defaultModel(input.provider);
  const existing = await prisma.hotelAiProviderCredential.findUnique({
    where: { hotelTenantId_provider: { hotelTenantId, provider: input.provider } },
  });
  let apiKeyEncrypted = existing?.apiKeyEncrypted ?? "";
  let apiKeyLast4 = existing?.apiKeyLast4 ?? "";
  if (input.clearKey) {
    apiKeyEncrypted = "";
    apiKeyLast4 = "";
  } else if (input.apiKey?.trim()) {
    const apiKey = input.apiKey.trim();
    apiKeyEncrypted = encryptAiSecret(apiKey);
    apiKeyLast4 = apiKey.slice(-4);
  }
  if (existing) {
    await prisma.hotelAiProviderCredential.update({
      where: { hotelTenantId_provider: { hotelTenantId, provider: input.provider } },
      data: { model, apiKeyEncrypted, apiKeyLast4 },
    });
  } else {
    await prisma.hotelAiProviderCredential.create({
      data: { id: randomUUID(), hotelTenantId, provider: input.provider, model, apiKeyEncrypted, apiKeyLast4 },
    });
  }
  const activeProvider = input.activeProvider && isAiProviderId(input.activeProvider)
    ? input.activeProvider
    : (AI_PROVIDERS[input.provider].implemented ? input.provider : undefined);
  if (activeProvider) {
    await prisma.hotelAiSettings.upsert({
      where: { hotelTenantId },
      update: { activeProvider },
      create: { hotelTenantId, activeProvider },
    });
  } else if (!await prisma.hotelAiSettings.findUnique({ where: { hotelTenantId } })) {
    await prisma.hotelAiSettings.create({ data: { hotelTenantId, activeProvider: "openai" } });
  }
  return listHotelAiProviders(prisma, hotelTenantId);
}

export async function hotelHasActiveAiKey(prisma: HotelAiDb, hotelTenantId: string) {
  try {
    const settings = await prisma.hotelAiSettings.findUnique({ where: { hotelTenantId } });
    const provider = isAiProviderId(settings?.activeProvider) ? settings.activeProvider : "openai";
    const row = await prisma.hotelAiProviderCredential.findUnique({
      where: { hotelTenantId_provider: { hotelTenantId, provider } },
      select: { apiKeyEncrypted: true },
    });
    return Boolean(row?.apiKeyEncrypted);
  } catch {
    return false;
  }
}

async function loadActiveCredential(prisma: HotelAiDb, hotelTenantId: string) {
  await ensureHotelAiTables();
  const settings = await prisma.hotelAiSettings.findUnique({ where: { hotelTenantId } });
  const provider = isAiProviderId(settings?.activeProvider) ? settings.activeProvider : "openai";
  if (!AI_PROVIDERS[provider].implemented) return null;
  const row = await prisma.hotelAiProviderCredential.findUnique({
    where: { hotelTenantId_provider: { hotelTenantId, provider } },
  });
  if (!row?.apiKeyEncrypted) return null;
  const models = providerModels(provider);
  const model = row.model && models.includes(row.model) ? row.model : defaultModel(provider);
  return { provider, model, apiKey: decryptAiSecret(row.apiKeyEncrypted) };
}

async function completeOpenAi(apiKey: string, model: string, messages: { role: string; content: string }[], options: { json?: boolean; temperature?: number; timeoutMs?: number }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.2,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
  });
  const data = (await response.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed.");
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty model reply.");
  return content;
}

async function completeClaude(apiKey: string, model: string, messages: { role: string; content: string }[], options: { json?: boolean; temperature?: number; timeoutMs?: number }) {
  const systemParts = messages.filter((message) => message.role === "system").map((message) => message.content.trim()).filter(Boolean);
  if (options.json) systemParts.push("Reply with a single valid JSON object only. Do not use markdown.");
  const chat = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));
  if (!chat.length || chat[0].role !== "user") chat.unshift({ role: "user", content: "Continue." });
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: options.temperature ?? 0.2,
      ...(systemParts.length ? { system: systemParts.join("\n\n") } : {}),
      messages: chat,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
  });
  const data = (await response.json().catch(() => null)) as { content?: { type?: string; text?: string }[]; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(data?.error?.message || "Claude request failed.");
  const content = data?.content?.filter((part) => part.type === "text").map((part) => part.text || "").join("\n").trim();
  if (!content) throw new Error("Empty model reply.");
  return content;
}

export async function completeHotelChat(
  prisma: HotelAiDb,
  hotelTenantId: string,
  messages: { role: string; content: string }[],
  options: { json?: boolean; temperature?: number; timeoutMs?: number; required?: boolean } = {},
) {
  const credential = await loadActiveCredential(prisma, hotelTenantId);
  if (!credential) {
    if (options.required) throw new HotelAiNotConfiguredError();
    return null;
  }
  if (credential.provider === "openai") return completeOpenAi(credential.apiKey, credential.model, messages, options);
  if (credential.provider === "claude") return completeClaude(credential.apiKey, credential.model, messages, options);
  throw new Error(`${AI_PROVIDERS[credential.provider].name} is not enabled yet.`);
}

export async function completeHotelChatJson(
  prisma: HotelAiDb,
  hotelTenantId: string,
  messages: { role: string; content: string }[],
  options: { temperature?: number; timeoutMs?: number; required?: boolean } = {},
) {
  const content = await completeHotelChat(prisma, hotelTenantId, messages, { ...options, json: true });
  if (!content) return null;
  const trimmed = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(trimmed) as Record<string, unknown>;
}
