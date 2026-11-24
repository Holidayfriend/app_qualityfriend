CREATE TABLE "own_room_rates" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "rate_date" DATE NOT NULL,
  "rate_plan" VARCHAR(40) NOT NULL,
  "price_per_person_1" DECIMAL(14,2),
  "price_per_person_2" DECIMAL(14,2),
  "room_price_2_adults" DECIMAL(14,2),
  "fetched_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "own_room_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "own_room_rates_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "own_room_rates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "room_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "own_room_rates_hotel_tenant_id_category_id_rate_date_key" ON "own_room_rates"("hotel_tenant_id", "category_id", "rate_date");
CREATE INDEX "own_room_rates_hotel_tenant_id_rate_date_idx" ON "own_room_rates"("hotel_tenant_id", "rate_date");
