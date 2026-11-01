ALTER TABLE "manual_documents" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "manual_documents" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(3);
CREATE INDEX IF NOT EXISTS "manual_documents_hotel_tenant_id_is_deleted_idx" ON "manual_documents"("hotel_tenant_id", "is_deleted");
