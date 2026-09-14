CREATE TYPE "HousekeepingChecklistType" AS ENUM ('ROOM', 'ARRIVAL');

CREATE TABLE "housekeeping_checklist_completions" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "work_date" DATE NOT NULL,
  "checklist_type" "HousekeepingChecklistType" NOT NULL,
  "check_index" INTEGER NOT NULL,
  "check_text_en" TEXT NOT NULL,
  "check_text_de" TEXT NOT NULL,
  "check_text_it" TEXT NOT NULL,
  "checked_by_id" UUID NOT NULL,
  "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "housekeeping_checklist_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hk_check_completion_per_day_key"
  ON "housekeeping_checklist_completions" ("hotel_tenant_id", "work_date", "room_id", "checklist_type", "check_index");
CREATE INDEX "hk_check_completion_room_day_idx"
  ON "housekeeping_checklist_completions" ("hotel_tenant_id", "room_id", "work_date");

ALTER TABLE "housekeeping_checklist_completions"
  ADD CONSTRAINT "hk_check_completion_hotel_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hk_check_completion_room_fkey" FOREIGN KEY ("hotel_tenant_id", "room_id") REFERENCES "rooms"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hk_check_completion_user_fkey" FOREIGN KEY ("hotel_tenant_id", "checked_by_id") REFERENCES "users"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hk_check_completion_index_check" CHECK ("check_index" >= 0);
