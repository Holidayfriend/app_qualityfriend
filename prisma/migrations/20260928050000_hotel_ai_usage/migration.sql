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
);

CREATE INDEX IF NOT EXISTS "hotel_ai_usage_hotel_tenant_id_created_at_idx"
  ON "hotel_ai_usage"("hotel_tenant_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "hotel_ai_usage"
    ADD CONSTRAINT "hotel_ai_usage_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
