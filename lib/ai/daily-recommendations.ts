import { Pool } from "pg";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { generateHotelRecruitingBriefing } from "../recruiting/daily-briefing";

export const AI_RECOMMENDATION_PLACES = ["RECRUITING", "DASHBOARD"] as const;
export type AiRecommendationPlace = (typeof AI_RECOMMENDATION_PLACES)[number];

/** Places the daily job writes today. Add DASHBOARD here when that generator exists. */
export const ENABLED_AI_RECOMMENDATION_PLACES: AiRecommendationPlace[] = ["RECRUITING"];

export async function ensureAiRecommendationTable() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "AiRecommendationPlace" AS ENUM ('RECRUITING', 'DASHBOARD');
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

async function generatePlace(prisma: PrismaClient, hotelTenantId: string, place: AiRecommendationPlace) {
  if (place === "RECRUITING") return generateHotelRecruitingBriefing(prisma, hotelTenantId);
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
    for (const place of ENABLED_AI_RECOMMENDATION_PLACES) {
      try {
        results.push({ ok: true, place, ...await generatePlace(prisma, hotel.id, place) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ok: false, hotelTenantId: hotel.id, place, error: message });
        console.error(JSON.stringify({ hotelTenantId: hotel.id, place, error: message }));
      }
    }
  }
  return results;
}
