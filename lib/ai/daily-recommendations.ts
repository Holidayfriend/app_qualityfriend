import { Pool } from "pg";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { generateHotelRecruitingBriefing } from "../recruiting/daily-briefing";
import { collectOpsFacts, generateOpsBriefing, type OpsPlace } from "./ops-briefing";
import type { OpsFacts } from "./ops-briefing-text";

export const AI_RECOMMENDATION_PLACES = ["DASHBOARD", "HANDOVERS", "TASKS", "RECRUITING"] as const;
export type AiRecommendationPlace = (typeof AI_RECOMMENDATION_PLACES)[number];

export const ENABLED_AI_RECOMMENDATION_PLACES: AiRecommendationPlace[] = ["DASHBOARD", "HANDOVERS", "TASKS", "RECRUITING"];

function isOpsPlace(place: AiRecommendationPlace): place is OpsPlace {
  return place === "DASHBOARD" || place === "HANDOVERS" || place === "TASKS";
}

export async function ensureAiRecommendationTable() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "AiRecommendationPlace" AS ENUM ('RECRUITING', 'DASHBOARD', 'HANDOVERS', 'TASKS');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "hotel_ai_recommendations" (
        "id" UUID NOT NULL,
        "hotel_tenant_id" UUID NOT NULL,
        "place" "AiRecommendationPlace" NOT NULL,
        "body_en" TEXT NOT NULL DEFAULT '',
        "body_de" TEXT NOT NULL DEFAULT '',
        "body_it" TEXT NOT NULL DEFAULT '',
        "generated_at" TIMESTAMPTZ(3) NOT NULL,
        CONSTRAINT "hotel_ai_recommendations_pkey" PRIMARY KEY ("id")
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "hotel_ai_recommendations_hotel_tenant_id_place_key"
        ON "hotel_ai_recommendations"("hotel_tenant_id", "place")
    `);
    await pool.query(`ALTER TYPE "AiRecommendationPlace" ADD VALUE IF NOT EXISTS 'HANDOVERS'`);
    await pool.query(`ALTER TYPE "AiRecommendationPlace" ADD VALUE IF NOT EXISTS 'TASKS'`);
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'recruiting_ai_briefings'
        ) THEN
          INSERT INTO "hotel_ai_recommendations" ("id", "hotel_tenant_id", "place", "body_en", "body_de", "body_it", "generated_at")
          SELECT "id", "hotel_tenant_id", 'RECRUITING'::"AiRecommendationPlace", "body_en", "body_de", "body_it", "generated_at"
          FROM "recruiting_ai_briefings"
          ON CONFLICT ("hotel_tenant_id", "place") DO NOTHING;
        END IF;
      END $$
    `);
  } finally {
    await pool.end();
  }
}

async function generatePlace(prisma: PrismaClient, hotelTenantId: string, place: AiRecommendationPlace, facts: OpsFacts | null) {
  if (place === "RECRUITING") return generateHotelRecruitingBriefing(prisma, hotelTenantId);
  if (isOpsPlace(place) && facts) return generateOpsBriefing(prisma, hotelTenantId, place, facts);
  return { hotelTenantId, place, skipped: true };
}

export async function generateAllHotelAiRecommendations(prisma: PrismaClient, hotelTenantId?: string) {
  await ensureAiRecommendationTable();
  const hotels = await prisma.hotelTenant.findMany({
    where: { isActive: true, ...(hotelTenantId ? { id: hotelTenantId } : {}) },
    select: { id: true },
  });
  const results: Array<Record<string, unknown>> = [];
  for (const hotel of hotels) {
    let facts: OpsFacts | null = null;
    try {
      facts = await collectOpsFacts(prisma, hotel.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ hotelTenantId: hotel.id, place: "OPS", error: message }));
    }
    for (const place of ENABLED_AI_RECOMMENDATION_PLACES) {
      try {
        if (isOpsPlace(place) && !facts) throw new Error("Operational facts were not collected.");
        results.push({ ok: true, place, ...await generatePlace(prisma, hotel.id, place, facts) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ok: false, hotelTenantId: hotel.id, place, error: message });
        console.error(JSON.stringify({ hotelTenantId: hotel.id, place, error: message }));
      }
    }
  }
  return results;
}
