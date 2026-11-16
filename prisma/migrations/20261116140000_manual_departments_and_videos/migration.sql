CREATE TABLE "manual_document_departments" (
    "document_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "manual_document_departments_pkey" PRIMARY KEY ("document_id","department_id")
);

CREATE INDEX "manual_document_departments_department_id_idx" ON "manual_document_departments"("department_id");

ALTER TABLE "manual_document_departments" ADD CONSTRAINT "manual_document_departments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "manual_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manual_document_departments" ADD CONSTRAINT "manual_document_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "manual_document_departments" ("document_id", "department_id")
SELECT "id", "department_id" FROM "manual_documents" WHERE "department_id" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE "manual_videos" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "original_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(160) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_videos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manual_videos_document_id_idx" ON "manual_videos"("document_id");
CREATE INDEX "manual_videos_hotel_tenant_id_idx" ON "manual_videos"("hotel_tenant_id");

ALTER TABLE "manual_videos" ADD CONSTRAINT "manual_videos_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "manual_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
