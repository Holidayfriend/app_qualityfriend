ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "split_start_time" VARCHAR(5) NOT NULL DEFAULT '';
ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "split_end_time" VARCHAR(5) NOT NULL DEFAULT '';
ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "split_break_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hotel_shift_drafts" ADD COLUMN IF NOT EXISTS "split_start_time" VARCHAR(5) NOT NULL DEFAULT '';
ALTER TABLE "hotel_shift_drafts" ADD COLUMN IF NOT EXISTS "split_end_time" VARCHAR(5) NOT NULL DEFAULT '';
ALTER TABLE "hotel_shift_drafts" ADD COLUMN IF NOT EXISTS "split_break_minutes" INTEGER NOT NULL DEFAULT 0;
