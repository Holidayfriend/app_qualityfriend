CREATE TABLE "handover_attachments" (
    "id" UUID NOT NULL,
    "handover_id" UUID NOT NULL,
    "file_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "handover_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "handover_attachments_handover_id_idx" ON "handover_attachments"("handover_id");

ALTER TABLE "handover_attachments" ADD CONSTRAINT "handover_attachments_handover_id_fkey"
FOREIGN KEY ("handover_id") REFERENCES "handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hotel_checklist_attachments" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "file_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotel_checklist_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_checklist_attachments_checklist_id_idx" ON "hotel_checklist_attachments"("checklist_id");

ALTER TABLE "hotel_checklist_attachments" ADD CONSTRAINT "hotel_checklist_attachments_checklist_id_fkey"
FOREIGN KEY ("checklist_id") REFERENCES "hotel_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
