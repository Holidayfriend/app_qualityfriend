CREATE TABLE "forecast_narratives" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "price_en" TEXT NOT NULL DEFAULT '',
  "price_de" TEXT NOT NULL DEFAULT '',
  "price_it" TEXT NOT NULL DEFAULT '',
  "competitor_en" TEXT NOT NULL DEFAULT '',
  "competitor_de" TEXT NOT NULL DEFAULT '',
  "competitor_it" TEXT NOT NULL DEFAULT '',
  "generated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "forecast_narratives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "forecast_narratives_hotel_tenant_id_key" ON "forecast_narratives"("hotel_tenant_id");

ALTER TABLE "forecast_narratives" ADD CONSTRAINT "forecast_narratives_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
