CREATE TABLE "hotel_checklist_item_attachments" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "file_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_checklist_item_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_checklist_item_attachments_item_id_idx" ON "hotel_checklist_item_attachments"("item_id");

ALTER TABLE "hotel_checklist_item_attachments" ADD CONSTRAINT "hotel_checklist_item_attachments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "hotel_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
