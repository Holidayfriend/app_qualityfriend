CREATE TABLE IF NOT EXISTS "recruiting_job_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_tenant_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "team" VARCHAR(120) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "application_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiting_job_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recruiting_job_campaigns_hotel_tenant_id_id_key" ON "recruiting_job_campaigns"("hotel_tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "recruiting_job_campaigns_code_key" ON "recruiting_job_campaigns"("code");
CREATE INDEX IF NOT EXISTS "recruiting_job_campaigns_hotel_job_idx" ON "recruiting_job_campaigns"("hotel_tenant_id", "job_id");

DO $$ BEGIN
  ALTER TABLE "recruiting_job_campaigns" ADD CONSTRAINT "recruiting_job_campaigns_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "recruiting_job_campaigns" ADD CONSTRAINT "recruiting_job_campaigns_hotel_job_fkey"
    FOREIGN KEY ("hotel_tenant_id", "job_id") REFERENCES "recruiting_jobs"("hotel_tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
