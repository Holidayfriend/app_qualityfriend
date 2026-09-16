CREATE TABLE IF NOT EXISTS "hotel_weather" (
    "hotel_tenant_id" UUID NOT NULL,
    "city_name" VARCHAR(120) NOT NULL,
    "country_name" VARCHAR(120) NOT NULL,
    "address_key" VARCHAR(400) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "temperature_c" INTEGER NOT NULL,
    "weather_code" INTEGER NOT NULL,
    "condition_key" VARCHAR(40) NOT NULL,
    "icon" VARCHAR(16) NOT NULL,
    "rain_from_hour" VARCHAR(5),
    "wind_kmh" INTEGER NOT NULL,
    "uv_index" INTEGER NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_weather_pkey" PRIMARY KEY ("hotel_tenant_id")
);

DO $$ BEGIN
  ALTER TABLE "hotel_weather" ADD CONSTRAINT "hotel_weather_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
