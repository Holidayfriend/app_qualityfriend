ALTER TABLE "repairs" ADD COLUMN "completed_at" TIMESTAMPTZ(3);
ALTER TABLE "repairs" ADD COLUMN "completed_by_id" UUID;
CREATE INDEX "repairs_completed_by_id_idx" ON "repairs"("completed_by_id");
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
