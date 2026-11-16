ALTER TABLE "hotel_tasks" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hotel_tasks" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "hotel_tasks_hotel_tenant_id_is_deleted_idx" ON "hotel_tasks"("hotel_tenant_id", "is_deleted");

ALTER TABLE "hotel_checklists" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hotel_checklists" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "hotel_checklists_hotel_tenant_id_is_deleted_idx" ON "hotel_checklists"("hotel_tenant_id", "is_deleted");
