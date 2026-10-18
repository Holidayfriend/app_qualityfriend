import { NextResponse } from "next/server";
import { getPersonalMcpSession, getSessionUserId, refreshMcpSession } from "@/lib/auth/session";
import {
  getMcpUserPreferences,
  McpApiError,
  setMcpUserPreferences,
} from "@/lib/mcp/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const modelOptions = {
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  perplexity: ["sonar", "sonar-reasoning-pro", "sonar-deep-research"],
  claude: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5", "claude-opus-4-1"],
} as const;

type Provider = keyof typeof modelOptions;
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && Object.hasOwn(modelOptions, value);
}

async function currentMcpUser() {
  const id = await getSessionUserId();
  if (!id) return { error: "UNAUTHENTICATED" as const, status: 401 };
  let user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false },
    select: {
      email: true,
      mcpUserId: true,
      mcpUserPassword: true,
      hotelTenant: { select: { activeMcp: true, mcpHotelId: true, hotelNameEn: true } },
    },
  });
  if (!user) return { error: "UNAUTHENTICATED" as const, status: 401 };
  if (!user.hotelTenant.activeMcp || !user.hotelTenant.mcpHotelId) return { error: "MCP_NOT_ACTIVE" as const, status: 409 };
  if (!user.mcpUserId || !user.mcpUserPassword) {
    await refreshMcpSession(id);
    user = await prisma.user.findFirst({
      where: { id, isActive: true, isDeleted: false },
      select: {
        id: true,
        email: true,
        mcpUserId: true,
        mcpUserPassword: true,
        hotelTenant: { select: { activeMcp: true, mcpHotelId: true, hotelNameEn: true } },
      },
    });
  }
  if (!user?.mcpUserId || !user.mcpUserPassword) return { error: "MCP_USER_NOT_SYNCED" as const, status: 409 };
  const session = await getPersonalMcpSession(id);
  if (!session) return { error: "MCP_USER_NOT_SYNCED" as const, status: 409 };
  return { user, ...session };
}

function remoteFailure(error: unknown, fallback: string) {
  console.error(fallback, error);
  return NextResponse.json(
    { error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : fallback },
    { status: 502 },
  );
}

export async function GET() {
  try {
    const context = await currentMcpUser();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const preferencesPayload = await getMcpUserPreferences(context.token);
    const profile = object(context.profile);
    const hotel = object(profile.hotel);
    const department = object(profile.department);
    const preferenceRoot = object(preferencesPayload);
    const preferences = object(preferenceRoot.userPrefs ?? preferenceRoot);
    const enabledProviders = Array.isArray(preferences.enabledProviders)
      ? preferences.enabledProviders.filter(isProvider)
      : [];
    const defaultProvider = isProvider(preferences.defaultProvider) ? preferences.defaultProvider : null;
    const remoteModels = object(preferences.models);
    const models = Object.fromEntries(
      (Object.keys(modelOptions) as Provider[]).map((provider) => {
        const remote = text(remoteModels[provider]);
        return [provider, remote || modelOptions[provider][0]];
      }),
    );
    return NextResponse.json({
      account: {
        hotel: context.user.hotelTenant.hotelNameEn || text(hotel.name),
        role: text(profile.role),
        department: text(department.name),
        email: context.user.email,
      },
      preferences: { enabledProviders, defaultProvider, models },
    });
  } catch (error) {
    return remoteFailure(error, "MCP personal settings could not be loaded.");
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  try {
    const context = await currentMcpUser();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });

    if (body.action === "preferences") {
      const enabledProviders: Provider[] = Array.isArray(body.enabledProviders)
        ? [...new Set<Provider>((body.enabledProviders as unknown[]).filter(isProvider))]
        : [];
      const defaultProvider = body.defaultProvider === null || body.defaultProvider === "" ? null : body.defaultProvider;
      if (!enabledProviders.length) return NextResponse.json({ error: "PROVIDER_REQUIRED" }, { status: 400 });
      if (defaultProvider !== null && (!isProvider(defaultProvider) || !enabledProviders.includes(defaultProvider))) {
        return NextResponse.json({ error: "DEFAULT_PROVIDER_NOT_ENABLED" }, { status: 400 });
      }
      const suppliedModels = object(body.models);
      const models = Object.fromEntries(
        (Object.keys(modelOptions) as Provider[]).map((provider) => {
          const selected = text(suppliedModels[provider]);
          return [provider, (modelOptions[provider] as readonly string[]).includes(selected) ? selected : modelOptions[provider][0]];
        }),
      );
      const result = await setMcpUserPreferences(context.token, { enabledProviders, defaultProvider, models });
      return NextResponse.json({ success: true, preferences: { enabledProviders, defaultProvider, models }, result });
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    return remoteFailure(error, "MCP personal settings could not be saved.");
  }
}
