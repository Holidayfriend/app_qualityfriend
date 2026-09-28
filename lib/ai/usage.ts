import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { AI_PROVIDERS, type AiProviderId } from "./providers";

export type AiUsageRange = "today" | "week" | "month" | "custom";

export type AiUsageModelRow = {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiUsageProviderRow = {
  id: string;
  name: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  models: AiUsageModelRow[];
};

export type TokenUsage = { inputTokens: number; outputTokens: number; totalTokens: number };

const USAGE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "hotel_ai_usage" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotel_ai_usage_pkey" PRIMARY KEY ("id")
  )
`;

async function withUsagePool<T>(run: (pool: Pool) => Promise<T>) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

export async function ensureHotelAiUsageTable() {
  await withUsagePool(async (pool) => {
    await pool.query(USAGE_TABLE_SQL);
    await pool.query(`CREATE INDEX IF NOT EXISTS "hotel_ai_usage_hotel_tenant_id_created_at_idx" ON "hotel_ai_usage"("hotel_tenant_id", "created_at")`);
  });
}

export async function recordHotelAiUsage(hotelTenantId: string, provider: string, model: string, usage: TokenUsage) {
  try {
    await ensureHotelAiUsageTable();
    await withUsagePool((pool) => pool.query(
      `INSERT INTO hotel_ai_usage (id, hotel_tenant_id, provider, model, input_tokens, output_tokens, total_tokens, created_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, NOW())`,
      [randomUUID(), hotelTenantId, provider.slice(0, 40), model.slice(0, 80), usage.inputTokens, usage.outputTokens, usage.totalTokens],
    ));
  } catch {
    // A usage write must not block the AI reply.
  }
}

type UsageQuery = {
  $queryRaw: PrismaClient["$queryRaw"];
  hotelTenant: { findUnique: PrismaClient["hotelTenant"]["findUnique"] };
};

function asCount(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function timeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour") % 24, value("minute"), value("second"));
  return asUtc - date.getTime();
}

function zonedMidnight(timeZone: string, year: number, month: number, day: number) {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const first = timeZoneOffsetMs(timeZone, guess);
  const utc = new Date(guess.getTime() - first);
  const second = timeZoneOffsetMs(timeZone, utc);
  return first === second ? utc : new Date(guess.getTime() - second);
}

function zonedYmd(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function shiftDays(year: number, month: number, day: number, delta: number) {
  const next = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function safeTimeZone(value: string | null | undefined) {
  const zone = value?.trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return "UTC";
  }
}

export function usageRangeStart(range: Exclude<AiUsageRange, "custom">, timeZone: string, now = new Date()) {
  const today = zonedYmd(timeZone, now);
  if (range === "month") return zonedMidnight(timeZone, today.year, today.month, 1);
  if (range === "week") {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
    const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
    const fromMonday = ((index < 0 ? 1 : index) + 6) % 7;
    const start = shiftDays(today.year, today.month, today.day, -fromMonday);
    return zonedMidnight(timeZone, start.year, start.month, start.day);
  }
  return zonedMidnight(timeZone, today.year, today.month, today.day);
}

export function isAiUsageRange(value: unknown): value is AiUsageRange {
  return value === "today" || value === "week" || value === "month" || value === "custom";
}

export function parseUsageDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function usageWindow(range: AiUsageRange, timeZone: string, dates?: { from?: string; to?: string }) {
  const today = zonedYmd(timeZone, new Date());
  const tomorrow = shiftDays(today.year, today.month, today.day, 1);
  if (range !== "custom") {
    return { from: usageRangeStart(range, timeZone), until: zonedMidnight(timeZone, tomorrow.year, tomorrow.month, tomorrow.day) };
  }
  const start = parseUsageDate(dates?.from);
  const end = parseUsageDate(dates?.to);
  if (!start || !end) throw new Error("INVALID_RANGE");
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  const [first, last] = startUtc <= endUtc ? [start, end] : [end, start];
  const next = shiftDays(last.year, last.month, last.day, 1);
  return {
    from: zonedMidnight(timeZone, first.year, first.month, first.day),
    until: zonedMidnight(timeZone, next.year, next.month, next.day),
  };
}

export async function listHotelAiUsage(prisma: UsageQuery, hotelTenantId: string, range: AiUsageRange, dates?: { from?: string; to?: string }) {
  await ensureHotelAiUsageTable();
  const hotel = await prisma.hotelTenant.findUnique({ where: { id: hotelTenantId }, select: { timeZone: true } });
  const timeZone = safeTimeZone(hotel?.timeZone);
  const { from, until } = usageWindow(range, timeZone, dates);
  const rows = await prisma.$queryRaw<Array<{ provider: string; model: string; requests: unknown; input_tokens: unknown; output_tokens: unknown; total_tokens: unknown }>>`
    SELECT provider, model,
      COUNT(*)::bigint AS requests,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
    FROM hotel_ai_usage
    WHERE hotel_tenant_id = ${hotelTenantId}::uuid
      AND created_at >= ${from}
      AND created_at < ${until}
    GROUP BY provider, model
  `;
  const byProvider = new Map<string, AiUsageProviderRow>();
  for (const id of Object.keys(AI_PROVIDERS) as AiProviderId[]) {
    byProvider.set(id, {
      id,
      name: AI_PROVIDERS[id].name,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      models: [],
    });
  }
  for (const row of rows) {
    const model: AiUsageModelRow = {
      model: row.model,
      requests: asCount(row.requests),
      inputTokens: asCount(row.input_tokens),
      outputTokens: asCount(row.output_tokens),
      totalTokens: asCount(row.total_tokens),
    };
    const current = byProvider.get(row.provider) ?? {
      id: row.provider,
      name: row.provider,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      models: [],
    };
    current.requests += model.requests;
    current.inputTokens += model.inputTokens;
    current.outputTokens += model.outputTokens;
    current.totalTokens += model.totalTokens;
    current.models.push(model);
    byProvider.set(row.provider, current);
  }
  const providers = [...byProvider.values()].map((provider) => ({
    ...provider,
    models: provider.models.sort((left, right) => right.totalTokens - left.totalTokens || left.model.localeCompare(right.model)),
  }));
  const totals = providers.reduce((sum, provider) => ({
    requests: sum.requests + provider.requests,
    inputTokens: sum.inputTokens + provider.inputTokens,
    outputTokens: sum.outputTokens + provider.outputTokens,
    totalTokens: sum.totalTokens + provider.totalTokens,
  }), { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  return { range, timeZone, from: from.toISOString(), to: until.toISOString(), totals, providers };
}
