ALTER TABLE "repairs" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "repairs" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "repairs_hotel_tenant_id_is_deleted_idx" ON "repairs"("hotel_tenant_id", "is_deleted");
