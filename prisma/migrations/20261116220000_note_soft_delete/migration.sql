ALTER TABLE "hotel_notes" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hotel_notes" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX "hotel_notes_hotel_tenant_id_is_deleted_idx" ON "hotel_notes"("hotel_tenant_id", "is_deleted");
