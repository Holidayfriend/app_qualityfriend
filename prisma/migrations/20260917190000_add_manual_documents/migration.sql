-- CreateTable
CREATE TABLE "manual_documents" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "created_by_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "original_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(160) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manual_documents_hotel_tenant_id_created_at_idx" ON "manual_documents"("hotel_tenant_id", "created_at");
CREATE INDEX "manual_documents_hotel_tenant_id_department_id_idx" ON "manual_documents"("hotel_tenant_id", "department_id");
CREATE INDEX "manual_documents_created_by_id_idx" ON "manual_documents"("created_by_id");

ALTER TABLE "manual_documents" ADD CONSTRAINT "manual_documents_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manual_documents" ADD CONSTRAINT "manual_documents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manual_documents" ADD CONSTRAINT "manual_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
