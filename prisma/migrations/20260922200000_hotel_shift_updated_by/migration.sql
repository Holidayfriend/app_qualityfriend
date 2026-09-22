ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "updated_by_id" UUID;
UPDATE "hotel_shifts" SET "updated_by_id" = "created_by_id" WHERE "updated_by_id" IS NULL;
CREATE INDEX IF NOT EXISTS "hotel_shifts_updated_by_id_idx" ON "hotel_shifts"("updated_by_id");
DO $$ BEGIN
  ALTER TABLE "hotel_shifts" ADD CONSTRAINT "hotel_shifts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
