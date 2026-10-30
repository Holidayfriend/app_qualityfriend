CREATE TABLE "hotel_task_attachments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "file_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotel_task_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_task_attachments_task_id_idx" ON "hotel_task_attachments"("task_id");

ALTER TABLE "hotel_task_attachments" ADD CONSTRAINT "hotel_task_attachments_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "hotel_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
