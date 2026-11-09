CREATE TABLE "forecast_reservations" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "external_id" VARCHAR(64) NOT NULL,
  "reservation_date" DATE,
  "number" VARCHAR(40) NOT NULL DEFAULT '',
  "type" VARCHAR(40) NOT NULL DEFAULT '',
  "tourist_party" INTEGER NOT NULL DEFAULT 0,
  "advertising_medium" VARCHAR(80),
  "booking_channel" VARCHAR(120),
  "booking_group" VARCHAR(255),
  "guest_gender" VARCHAR(20),
  "guest_date_of_birth" DATE,
  "guest_postal_code" VARCHAR(20),
  "guest_city" VARCHAR(120),
  "guest_country" VARCHAR(80),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "forecast_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_reservation_rooms" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "forecast_reservation_id" UUID NOT NULL,
  "arrival_date" DATE NOT NULL,
  "departure_date" DATE NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT '',
  "room_type" VARCHAR(80) NOT NULL DEFAULT '',
  "room_number" VARCHAR(40) NOT NULL DEFAULT '',
  "rate_plan_code" VARCHAR(80),
  "adults" INTEGER,
  "children" INTEGER,
  "infants" INTEGER,
  "accommodation_sale" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "additional_services_sale" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "spa_sale" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "extras_sale" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "forecast_reservation_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_reservation_guests" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "forecast_room_id" UUID NOT NULL,
  "gender" VARCHAR(20),
  "date_of_birth" DATE,
  "country" VARCHAR(80),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "forecast_reservation_guests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "forecast_reservations_hotel_tenant_id_external_id_key" ON "forecast_reservations"("hotel_tenant_id", "external_id");
CREATE INDEX "forecast_reservations_hotel_tenant_id_reservation_date_idx" ON "forecast_reservations"("hotel_tenant_id", "reservation_date");
CREATE INDEX "forecast_reservation_rooms_hotel_tenant_id_arrival_date_idx" ON "forecast_reservation_rooms"("hotel_tenant_id", "arrival_date");
CREATE INDEX "forecast_reservation_rooms_hotel_tenant_id_departure_date_idx" ON "forecast_reservation_rooms"("hotel_tenant_id", "departure_date");
CREATE INDEX "forecast_reservation_rooms_hotel_tenant_id_room_type_idx" ON "forecast_reservation_rooms"("hotel_tenant_id", "room_type");
CREATE INDEX "forecast_reservation_guests_hotel_tenant_id_forecast_room_id_idx" ON "forecast_reservation_guests"("hotel_tenant_id", "forecast_room_id");

ALTER TABLE "forecast_reservations" ADD CONSTRAINT "forecast_reservations_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_reservation_rooms" ADD CONSTRAINT "forecast_reservation_rooms_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_reservation_rooms" ADD CONSTRAINT "forecast_reservation_rooms_forecast_reservation_id_fkey" FOREIGN KEY ("forecast_reservation_id") REFERENCES "forecast_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_reservation_guests" ADD CONSTRAINT "forecast_reservation_guests_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_reservation_guests" ADD CONSTRAINT "forecast_reservation_guests_forecast_room_id_fkey" FOREIGN KEY ("forecast_room_id") REFERENCES "forecast_reservation_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
