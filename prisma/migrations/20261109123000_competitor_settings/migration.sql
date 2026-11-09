CREATE TABLE "competitor_settings" (
  "hotel_tenant_id" UUID NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "location_code" INTEGER NOT NULL,
  "location_name" VARCHAR(255) NOT NULL,
  "must_include" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "competitor_settings_pkey" PRIMARY KEY ("hotel_tenant_id"),
  CONSTRAINT "competitor_settings_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
