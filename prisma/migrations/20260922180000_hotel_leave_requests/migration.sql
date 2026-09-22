ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "leave_category" VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "leave_duration" VARCHAR(20) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "hotel_leave_requests" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "duration" VARCHAR(20) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL DEFAULT '',
    "end_time" VARCHAR(5) NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "note_de" TEXT NOT NULL DEFAULT '',
    "note_it" TEXT NOT NULL DEFAULT '',
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "status" VARCHAR(20) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'REQUEST',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotel_leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "hotel_leave_requests_hotel_tenant_id_status_start_date_idx" ON "hotel_leave_requests"("hotel_tenant_id", "status", "start_date");
CREATE INDEX IF NOT EXISTS "hotel_leave_requests_user_id_start_date_idx" ON "hotel_leave_requests"("user_id", "start_date");
CREATE INDEX IF NOT EXISTS "hotel_leave_requests_created_by_id_idx" ON "hotel_leave_requests"("created_by_id");

DO $$ BEGIN
  ALTER TABLE "hotel_leave_requests" ADD CONSTRAINT "hotel_leave_requests_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "hotel_leave_requests" ADD CONSTRAINT "hotel_leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "hotel_leave_requests" ADD CONSTRAINT "hotel_leave_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "hotel_leave_requests" ADD CONSTRAINT "hotel_leave_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
