-- Review-only, hand-authored migration. No migration commands have been run.
-- No data import, destructive replacement, or AI implementation.
BEGIN;

ALTER TABLE "hotel_tenants" ADD COLUMN "time_zone" VARCHAR(80);

CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');
CREATE TYPE "ReservationStatus" AS ENUM ('UNKNOWN', 'RESERVED', 'OCCUPIED', 'DEPARTED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "RoomCleanliness" AS ENUM ('UNKNOWN', 'DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED');

CREATE TABLE "floors" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name_en" VARCHAR(180) NOT NULL,
  "name_de" VARCHAR(180),
  "name_it" VARCHAR(180),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "floors_hotel_tenant_id_id_key" ON "floors" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "floors_hotel_tenant_id_code_key" ON "floors" ("hotel_tenant_id", "code");

CREATE TABLE "room_categories" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "name_en" VARCHAR(180) NOT NULL,
  "name_de" VARCHAR(180),
  "name_it" VARCHAR(180),
  "express_minutes" INTEGER,
  "normal_minutes" INTEGER,
  "departure_minutes" INTEGER,
  "final_minutes" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "room_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "room_categories_hotel_tenant_id_id_key" ON "room_categories" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "room_categories_hotel_tenant_id_name_en_key" ON "room_categories" ("hotel_tenant_id", "name_en");

CREATE TABLE "rooms" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "number" VARCHAR(40) NOT NULL,
  "name_en" VARCHAR(180),
  "name_de" VARCHAR(180),
  "name_it" VARCHAR(180),
  "floor_id" UUID,
  "category_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rooms_hotel_tenant_id_id_key" ON "rooms" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "rooms_hotel_tenant_id_number_key" ON "rooms" ("hotel_tenant_id", "number");
CREATE INDEX "rooms_hotel_tenant_id_floor_id_idx" ON "rooms" ("hotel_tenant_id", "floor_id");
CREATE INDEX "rooms_hotel_tenant_id_category_id_idx" ON "rooms" ("hotel_tenant_id", "category_id");

CREATE TABLE "hotel_import_sources" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "provider" VARCHAR(80) NOT NULL DEFAULT 'ASA_XML',
  "source_key" VARCHAR(180) NOT NULL,
  "last_successful_at" TIMESTAMPTZ(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "hotel_import_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hotel_import_sources_hotel_tenant_id_id_key" ON "hotel_import_sources" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "hotel_import_sources_hotel_tenant_id_provider_source_key_key" ON "hotel_import_sources" ("hotel_tenant_id", "provider", "source_key");

CREATE TABLE "import_runs" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(3),
  "checksum" VARCHAR(64),
  "records_read" INTEGER NOT NULL DEFAULT 0,
  "records_created" INTEGER NOT NULL DEFAULT 0,
  "records_updated" INTEGER NOT NULL DEFAULT 0,
  "records_rejected" INTEGER NOT NULL DEFAULT 0,
  "error_summary" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "import_runs_hotel_tenant_id_id_key" ON "import_runs" ("hotel_tenant_id", "id");
CREATE INDEX "import_runs_hotel_tenant_id_source_id_started_at_idx" ON "import_runs" ("hotel_tenant_id", "source_id", "started_at");

CREATE TABLE "reservations" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "source_id" UUID,
  "external_id" VARCHAR(255),
  "source_status" VARCHAR(80),
  "status" "ReservationStatus" NOT NULL DEFAULT 'UNKNOWN',
  "booking_group" VARCHAR(255),
  "offer" TEXT,
  "board" VARCHAR(120),
  "last_seen_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reservations_hotel_tenant_id_id_key" ON "reservations" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "reservations_hotel_tenant_id_source_id_external_id_key" ON "reservations" ("hotel_tenant_id", "source_id", "external_id");
CREATE INDEX "reservations_hotel_tenant_id_status_idx" ON "reservations" ("hotel_tenant_id", "status");

CREATE TABLE "reservation_room_stays" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "source_segment_id" VARCHAR(255),
  "arrival_date" DATE NOT NULL,
  "departure_date" DATE NOT NULL,
  "checked_in_at" TIMESTAMPTZ(3),
  "checked_out_at" TIMESTAMPTZ(3),
  "source_status" VARCHAR(80),
  "adult_count" INTEGER,
  "child_count" INTEGER,
  "child_k1_count" INTEGER,
  "child_k2_count" INTEGER,
  "child_k3_count" INTEGER,
  "service_remarks" TEXT,
  "source_from_room_number" VARCHAR(40),
  "source_to_room_number" VARCHAR(40),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reservation_room_stays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reservation_room_stays_hotel_tenant_id_id_key" ON "reservation_room_stays" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "reservation_room_stays_hotel_tenant_id_reservation_id_source_segment_id_key" ON "reservation_room_stays" ("hotel_tenant_id", "reservation_id", "source_segment_id");
CREATE INDEX "reservation_room_stays_hotel_tenant_id_arrival_date_idx" ON "reservation_room_stays" ("hotel_tenant_id", "arrival_date");
CREATE INDEX "reservation_room_stays_hotel_tenant_id_departure_date_idx" ON "reservation_room_stays" ("hotel_tenant_id", "departure_date");
CREATE INDEX "reservation_room_stays_hotel_tenant_id_room_id_arrival_date_idx" ON "reservation_room_stays" ("hotel_tenant_id", "room_id", "arrival_date");

CREATE TABLE "reservation_guests" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "room_stay_id" UUID NOT NULL,
  "source_guest_id" VARCHAR(255),
  "name" VARCHAR(255) NOT NULL,
  "date_of_birth" DATE,
  "language" VARCHAR(40),
  "vip" BOOLEAN,
  "previous_stay_count" INTEGER,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reservation_guests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reservation_guests_hotel_tenant_id_id_key" ON "reservation_guests" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "reservation_guests_hotel_tenant_id_room_stay_id_source_guest_id_key" ON "reservation_guests" ("hotel_tenant_id", "room_stay_id", "source_guest_id");

CREATE TABLE "room_operational_states" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "cleanliness" "RoomCleanliness" NOT NULL DEFAULT 'UNKNOWN',
  "do_not_disturb" BOOLEAN NOT NULL DEFAULT false,
  "no_service" BOOLEAN NOT NULL DEFAULT false,
  "do_not_disturb_until" TIMESTAMPTZ(3),
  "no_service_until" TIMESTAMPTZ(3),
  "is_express" BOOLEAN NOT NULL DEFAULT false,
  "express_deadline" TIMESTAMPTZ(3),
  "last_cleaned_at" TIMESTAMPTZ(3),
  "last_inspected_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "room_operational_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "room_operational_states_hotel_tenant_id_id_key" ON "room_operational_states" ("hotel_tenant_id", "id");
CREATE UNIQUE INDEX "room_operational_states_hotel_tenant_id_room_id_key" ON "room_operational_states" ("hotel_tenant_id", "room_id");
CREATE INDEX "room_operational_states_hotel_tenant_id_cleanliness_idx" ON "room_operational_states" ("hotel_tenant_id", "cleanliness");

ALTER TABLE "floors" ADD CONSTRAINT "floors_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "floors" ADD CONSTRAINT "floors_sort_order_check" CHECK ("sort_order" >= 0);
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_express_minutes_check" CHECK ("express_minutes" >= 0);
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_normal_minutes_check" CHECK ("normal_minutes" >= 0);
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_departure_minutes_check" CHECK ("departure_minutes" >= 0);
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_final_minutes_check" CHECK ("final_minutes" >= 0);
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "floor_id") REFERENCES "floors"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_category_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "category_id") REFERENCES "room_categories"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_import_sources" ADD CONSTRAINT "hotel_import_sources_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_source_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "source_id") REFERENCES "hotel_import_sources"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_records_read_check" CHECK ("records_read" >= 0);
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_records_created_check" CHECK ("records_created" >= 0);
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_records_updated_check" CHECK ("records_updated" >= 0);
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_records_rejected_check" CHECK ("records_rejected" >= 0);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_source_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "source_id") REFERENCES "hotel_import_sources"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_reservation_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "reservation_id") REFERENCES "reservations"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_room_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "room_id") REFERENCES "rooms"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_adult_count_check" CHECK ("adult_count" >= 0);
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_child_count_check" CHECK ("child_count" >= 0);
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_child_k1_count_check" CHECK ("child_k1_count" >= 0);
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_child_k2_count_check" CHECK ("child_k2_count" >= 0);
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "reservation_room_stays_child_k3_count_check" CHECK ("child_k3_count" >= 0);
ALTER TABLE "reservation_guests" ADD CONSTRAINT "reservation_guests_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_guests" ADD CONSTRAINT "reservation_guests_roomStay_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "room_stay_id") REFERENCES "reservation_room_stays"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_guests" ADD CONSTRAINT "reservation_guests_previous_stay_count_check" CHECK ("previous_stay_count" >= 0);
ALTER TABLE "room_operational_states" ADD CONSTRAINT "room_operational_states_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_operational_states" ADD CONSTRAINT "room_operational_states_room_tenant_fkey" FOREIGN KEY ("hotel_tenant_id", "room_id") REFERENCES "rooms"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_operational_states" ADD CONSTRAINT "room_operational_states_version_check" CHECK ("version" >= 1);

ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "room_stay_dates_check" CHECK ("departure_date" >= "arrival_date");
ALTER TABLE "reservation_room_stays" ADD CONSTRAINT "room_stay_actual_times_check" CHECK ("checked_out_at" IS NULL OR "checked_in_at" IS NULL OR "checked_out_at" >= "checked_in_at");
ALTER TABLE "import_runs" ADD CONSTRAINT "import_run_times_check" CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at");
COMMIT;
