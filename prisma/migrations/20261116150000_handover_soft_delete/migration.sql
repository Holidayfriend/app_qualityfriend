ALTER TABLE "handovers" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "handovers" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

CREATE INDEX "handovers_hotel_tenant_id_is_deleted_idx" ON "handovers"("hotel_tenant_id", "is_deleted");
