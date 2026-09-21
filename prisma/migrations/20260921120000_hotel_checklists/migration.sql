CREATE TYPE "HotelChecklistKind" AS ENUM ('CHECKLIST', 'TEMPLATE');
CREATE TYPE "HotelChecklistStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');
CREATE TYPE "HotelChecklistAssignType" AS ENUM ('ALL', 'DEPT', 'PERSON');
CREATE TYPE "HotelChecklistDueType" AS ENUM ('ONCE', 'RECURRING');
CREATE TYPE "HotelChecklistRecurrence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "HotelChecklistOrigin" AS ENUM ('ORIGINAL', 'RUN');
CREATE TYPE "HotelChecklistItemState" AS ENUM ('OPEN', 'DONE', 'EXCEPTION');

CREATE TABLE "hotel_checklists" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "original_id" UUID,
    "assignee_id" UUID,
    "department_id" UUID,
    "completed_by_id" UUID,
    "origin" "HotelChecklistOrigin" NOT NULL DEFAULT 'ORIGINAL',
    "kind" "HotelChecklistKind" NOT NULL DEFAULT 'CHECKLIST',
    "status" "HotelChecklistStatus" NOT NULL DEFAULT 'ACTIVE',
    "assign_type" "HotelChecklistAssignType" NOT NULL DEFAULT 'ALL',
    "due_type" "HotelChecklistDueType" NOT NULL DEFAULT 'ONCE',
    "recurrence" "HotelChecklistRecurrence" NOT NULL DEFAULT 'ONCE',
    "title" VARCHAR(180) NOT NULL,
    "title_de" VARCHAR(180) NOT NULL,
    "title_it" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "description_de" TEXT NOT NULL DEFAULT '',
    "description_it" TEXT NOT NULL DEFAULT '',
    "weekdays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "start_at" DATE,
    "end_at" DATE,
    "due_at" DATE,
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hotel_checklists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hotel_checklist_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "text" VARCHAR(300) NOT NULL,
    "text_de" VARCHAR(300) NOT NULL,
    "text_it" VARCHAR(300) NOT NULL,
    "state" "HotelChecklistItemState" NOT NULL DEFAULT 'OPEN',
    "comment" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hotel_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hotel_checklist_completions" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_checklist_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hotel_checklists_original_id_due_at_key" ON "hotel_checklists"("original_id", "due_at");
CREATE INDEX "hotel_checklists_hotel_tenant_id_kind_status_idx" ON "hotel_checklists"("hotel_tenant_id", "kind", "status");
CREATE INDEX "hotel_checklists_hotel_tenant_id_origin_completed_at_idx" ON "hotel_checklists"("hotel_tenant_id", "origin", "completed_at");
CREATE INDEX "hotel_checklists_created_by_id_idx" ON "hotel_checklists"("created_by_id");
CREATE INDEX "hotel_checklists_assignee_id_idx" ON "hotel_checklists"("assignee_id");
CREATE INDEX "hotel_checklists_completed_by_id_idx" ON "hotel_checklists"("completed_by_id");
CREATE INDEX "hotel_checklists_department_id_idx" ON "hotel_checklists"("department_id");
CREATE INDEX "hotel_checklist_items_checklist_id_sort_order_idx" ON "hotel_checklist_items"("checklist_id", "sort_order");
CREATE INDEX "hotel_checklist_completions_checklist_id_created_at_idx" ON "hotel_checklist_completions"("checklist_id", "created_at");
CREATE INDEX "hotel_checklist_completions_author_id_idx" ON "hotel_checklist_completions"("author_id");

ALTER TABLE "hotel_checklists" ADD CONSTRAINT "hotel_checklists_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_checklists" ADD CONSTRAINT "hotel_checklists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_checklists" ADD CONSTRAINT "hotel_checklists_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hotel_checklists" ADD CONSTRAINT "hotel_checklists_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hotel_checklists" ADD CONSTRAINT "hotel_checklists_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hotel_checklists" ADD CONSTRAINT "hotel_checklists_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "hotel_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_checklist_items" ADD CONSTRAINT "hotel_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "hotel_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_checklist_completions" ADD CONSTRAINT "hotel_checklist_completions_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "hotel_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_checklist_completions" ADD CONSTRAINT "hotel_checklist_completions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
