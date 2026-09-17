ALTER TABLE "manual_documents" ADD COLUMN "index_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "manual_documents" ADD COLUMN "index_error" TEXT;

CREATE TABLE "manual_chunks" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "department_id" UUID,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manual_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "manual_chunks_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "manual_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "manual_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "manual_chunks_hotel_tenant_id_document_id_idx" ON "manual_chunks"("hotel_tenant_id", "document_id");
CREATE INDEX "manual_chunks_hotel_tenant_id_department_id_idx" ON "manual_chunks"("hotel_tenant_id", "department_id");
