ALTER TABLE "recruiting_applications" ADD COLUMN IF NOT EXISTS "ai_summary_en" TEXT NOT NULL DEFAULT '';
ALTER TABLE "recruiting_applications" ADD COLUMN IF NOT EXISTS "ai_summary_de" TEXT NOT NULL DEFAULT '';
ALTER TABLE "recruiting_applications" ADD COLUMN IF NOT EXISTS "ai_summary_it" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "recruiting_ai_briefings" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "body_en" TEXT NOT NULL DEFAULT '',
  "body_de" TEXT NOT NULL DEFAULT '',
  "body_it" TEXT NOT NULL DEFAULT '',
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "recruiting_ai_briefings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recruiting_ai_briefings_hotel_tenant_id_key" ON "recruiting_ai_briefings"("hotel_tenant_id");
