CREATE TABLE "competitors" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "location_key" VARCHAR(120) NOT NULL,
  "external_key" VARCHAR(120) NOT NULL,
  "name" TEXT NOT NULL,
  "accommodation_type" TEXT,
  "url" TEXT,
  "rating" DOUBLE PRECISION,
  "review_count" INTEGER,
  "min_price" DECIMAL(14,2),
  "max_price" DECIMAL(14,2),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "image" TEXT,
  "mentions" JSONB NOT NULL DEFAULT '[]',
  "merchandising_labels" JSONB NOT NULL DEFAULT '[]',
  "hotel_address" TEXT,
  "raw_payload" JSONB NOT NULL,
  "last_fetched_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "competitors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitors_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "competitors_hotel_tenant_id_location_key_external_key_key" ON "competitors"("hotel_tenant_id", "location_key", "external_key");
CREATE INDEX "competitors_hotel_tenant_id_location_key_name_idx" ON "competitors"("hotel_tenant_id", "location_key", "name");
CREATE TABLE "competitor_address_cache" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "address" TEXT,
  "payload" JSONB,
  "requested_at" TIMESTAMPTZ(3) NOT NULL,
  "completed_at" TIMESTAMPTZ(3)
);
CREATE INDEX "competitor_address_cache_provider_requested_at_idx" ON "competitor_address_cache"("provider", "requested_at");
