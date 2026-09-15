CREATE TABLE "recruiting_application_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "url" VARCHAR(320) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiting_application_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruiting_application_files_hotel_tenant_id_id_key" ON "recruiting_application_files"("hotel_tenant_id", "id");
CREATE INDEX "recruiting_application_files_hotel_tenant_id_application_id_idx" ON "recruiting_application_files"("hotel_tenant_id", "application_id");

ALTER TABLE "recruiting_application_files" ADD CONSTRAINT "recruiting_application_files_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recruiting_application_files" ADD CONSTRAINT "recruiting_application_files_hotel_tenant_id_application_id_fkey"
    FOREIGN KEY ("hotel_tenant_id", "application_id") REFERENCES "recruiting_applications"("hotel_tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
