ALTER TABLE "hotel_checklist_items"
ADD COLUMN "assignee_id" UUID;

CREATE INDEX "hotel_checklist_items_assignee_id_idx"
ON "hotel_checklist_items"("assignee_id");

ALTER TABLE "hotel_checklist_items"
ADD CONSTRAINT "hotel_checklist_items_assignee_id_fkey"
FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
