DO $$ BEGIN
  CREATE TYPE "AiRecommendationPlace" AS ENUM ('RECRUITING', 'DASHBOARD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "hotel_ai_recommendations" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "place" "AiRecommendationPlace" NOT NULL,
  "body_en" TEXT NOT NULL DEFAULT '',
  "body_de" TEXT NOT NULL DEFAULT '',
  "body_it" TEXT NOT NULL DEFAULT '',
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "hotel_ai_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hotel_ai_recommendations_hotel_tenant_id_place_key"
  ON "hotel_ai_recommendations"("hotel_tenant_id", "place");

CREATE INDEX IF NOT EXISTS "hotel_ai_recommendations_hotel_tenant_id_idx"
  ON "hotel_ai_recommendations"("hotel_tenant_id");

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
END $$;

DROP TABLE IF EXISTS "recruiting_ai_briefings";
