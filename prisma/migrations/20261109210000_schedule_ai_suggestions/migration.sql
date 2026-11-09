CREATE TABLE "schedule_ai_suggestions" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "week_start" DATE NOT NULL,
  "title_en" VARCHAR(180) NOT NULL DEFAULT '',
  "title_de" VARCHAR(180) NOT NULL DEFAULT '',
  "title_it" VARCHAR(180) NOT NULL DEFAULT '',
  "body_en" TEXT NOT NULL DEFAULT '',
  "body_de" TEXT NOT NULL DEFAULT '',
  "body_it" TEXT NOT NULL DEFAULT '',
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "schedule_ai_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_ai_suggestions_hotel_tenant_id_week_start_key" ON "schedule_ai_suggestions"("hotel_tenant_id", "week_start");
CREATE INDEX "schedule_ai_suggestions_hotel_tenant_id_week_start_idx" ON "schedule_ai_suggestions"("hotel_tenant_id", "week_start");

ALTER TABLE "schedule_ai_suggestions" ADD CONSTRAINT "schedule_ai_suggestions_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
