CREATE TABLE "revenue_overviews" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "occupancy_percent" INTEGER NOT NULL,
  "occupancy_vs_last_year" INTEGER NOT NULL,
  "current_rate" DECIMAL(14,2),
  "recommended_rate" DECIMAL(14,2),
  "season_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "season_vs_last_year" DECIMAL(8,1),
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "revenue_overviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_overviews_hotel_tenant_id_key" ON "revenue_overviews"("hotel_tenant_id");

ALTER TABLE "revenue_overviews" ADD CONSTRAINT "revenue_overviews_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
