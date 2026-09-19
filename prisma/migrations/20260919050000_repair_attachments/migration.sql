CREATE TABLE "repair_attachments" (
    "id" UUID NOT NULL,
    "repair_id" UUID NOT NULL,
    "file_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repair_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "repair_attachments_repair_id_idx" ON "repair_attachments"("repair_id");
ALTER TABLE "repair_attachments" ADD CONSTRAINT "repair_attachments_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
