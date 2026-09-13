CREATE TABLE "extra_jobs" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "description_en" TEXT NOT NULL DEFAULT '',
    "description_de" TEXT NOT NULL DEFAULT '',
    "description_it" TEXT NOT NULL DEFAULT '',
    "minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "extra_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "extra_jobs_minutes_check" CHECK ("minutes" >= 0)
);

CREATE INDEX "extra_jobs_hotel_tenant_id_idx" ON "extra_jobs"("hotel_tenant_id");
ALTER TABLE "extra_jobs" ADD CONSTRAINT "extra_jobs_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
