ALTER TABLE "hotel_tasks" ADD COLUMN "completed_at" TIMESTAMPTZ(3);
ALTER TABLE "hotel_tasks" ADD COLUMN "completed_by_id" UUID;
CREATE INDEX "hotel_tasks_completed_by_id_idx" ON "hotel_tasks"("completed_by_id");
ALTER TABLE "hotel_tasks" ADD CONSTRAINT "hotel_tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
