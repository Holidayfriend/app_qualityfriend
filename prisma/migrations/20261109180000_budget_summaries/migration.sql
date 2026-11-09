CREATE TABLE "budget_month_summaries" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "occupancy_percent" INTEGER NOT NULL,
  "current_adr" DECIMAL(14, 2),
  "recommended_adr" DECIMAL(14, 2),
  "forecast_revenue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "last_year_revenue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "vs_last_year_percent" DECIMAL(8, 1),
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "budget_month_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_category_summaries" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "category_id" UUID NOT NULL,
  "name_en" VARCHAR(180) NOT NULL,
  "name_de" VARCHAR(180),
  "name_it" VARCHAR(180),
  "room_count" INTEGER NOT NULL,
  "occupancy_percent" INTEGER NOT NULL,
  "current_adr" DECIMAL(14, 2),
  "recommended_adr" DECIMAL(14, 2),
  "revenue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "revenue_share" INTEGER NOT NULL,
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "budget_category_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budget_month_summaries_hotel_tenant_id_year_month_key" ON "budget_month_summaries"("hotel_tenant_id", "year", "month");
CREATE INDEX "budget_month_summaries_hotel_tenant_id_year_month_idx" ON "budget_month_summaries"("hotel_tenant_id", "year", "month");
CREATE UNIQUE INDEX "budget_category_summaries_hotel_tenant_id_year_month_category_id_key" ON "budget_category_summaries"("hotel_tenant_id", "year", "month", "category_id");
CREATE INDEX "budget_category_summaries_hotel_tenant_id_year_month_idx" ON "budget_category_summaries"("hotel_tenant_id", "year", "month");

ALTER TABLE "budget_month_summaries" ADD CONSTRAINT "budget_month_summaries_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_category_summaries" ADD CONSTRAINT "budget_category_summaries_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
