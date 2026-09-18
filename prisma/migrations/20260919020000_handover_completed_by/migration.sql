ALTER TABLE "handovers" ADD COLUMN "completed_at" TIMESTAMPTZ(3);
ALTER TABLE "handovers" ADD COLUMN "completed_by_id" UUID;
CREATE INDEX "handovers_completed_by_id_idx" ON "handovers"("completed_by_id");
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
