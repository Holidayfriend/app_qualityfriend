CREATE TABLE IF NOT EXISTS "hotel_shift_drafts" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "template_id" UUID,
    "work_date" DATE NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL DEFAULT '',
    "end_time" VARCHAR(5) NOT NULL DEFAULT '',
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "leave_category" VARCHAR(20) NOT NULL DEFAULT '',
    "leave_duration" VARCHAR(20) NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "note_de" TEXT NOT NULL DEFAULT '',
    "note_it" TEXT NOT NULL DEFAULT '',
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID,
    CONSTRAINT "hotel_shift_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hotel_shift_drafts_hotel_tenant_id_user_id_work_date_key" ON "hotel_shift_drafts"("hotel_tenant_id", "user_id", "work_date");
CREATE INDEX IF NOT EXISTS "hotel_shift_drafts_hotel_tenant_id_work_date_idx" ON "hotel_shift_drafts"("hotel_tenant_id", "work_date");
CREATE INDEX IF NOT EXISTS "hotel_shift_drafts_user_id_work_date_idx" ON "hotel_shift_drafts"("user_id", "work_date");
CREATE INDEX IF NOT EXISTS "hotel_shift_drafts_created_by_id_idx" ON "hotel_shift_drafts"("created_by_id");
CREATE INDEX IF NOT EXISTS "hotel_shift_drafts_template_id_idx" ON "hotel_shift_drafts"("template_id");
CREATE INDEX IF NOT EXISTS "hotel_shift_drafts_updated_by_id_idx" ON "hotel_shift_drafts"("updated_by_id");

DO $$ BEGIN
  ALTER TABLE "hotel_shift_drafts" ADD CONSTRAINT "hotel_shift_drafts_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "hotel_shift_drafts" ADD CONSTRAINT "hotel_shift_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "hotel_shift_drafts" ADD CONSTRAINT "hotel_shift_drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "hotel_shift_drafts" ADD CONSTRAINT "hotel_shift_drafts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "hotel_shift_drafts" ADD CONSTRAINT "hotel_shift_drafts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "hotel_shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
