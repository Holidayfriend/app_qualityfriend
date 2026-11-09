CREATE TYPE "RevenueRecommendationStatus" AS ENUM ('URGENT', 'ADJUST', 'OPTIMAL');

CREATE TABLE "revenue_daily_recommendations" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "stay_date" DATE NOT NULL,
  "occupancy_percent" INTEGER NOT NULL,
  "current_rate" DECIMAL(14, 2),
  "recommended_rate" DECIMAL(14, 2),
  "competitor_avg" DECIMAL(14, 2),
  "status" "RevenueRecommendationStatus" NOT NULL,
  "adopted" BOOLEAN NOT NULL DEFAULT false,
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "revenue_daily_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_daily_recommendations_hotel_tenant_id_stay_date_key"
  ON "revenue_daily_recommendations"("hotel_tenant_id", "stay_date");

CREATE INDEX "revenue_daily_recommendations_hotel_tenant_id_stay_date_idx"
  ON "revenue_daily_recommendations"("hotel_tenant_id", "stay_date");

ALTER TABLE "revenue_daily_recommendations"
  ADD CONSTRAINT "revenue_daily_recommendations_hotel_tenant_id_fkey"
  FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
