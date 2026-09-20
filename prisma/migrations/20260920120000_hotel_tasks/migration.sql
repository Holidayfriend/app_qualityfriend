CREATE TYPE "HotelTaskStatus" AS ENUM ('OPEN', 'DONE');
CREATE TYPE "HotelTaskAssignType" AS ENUM ('DEPT', 'PERSON');

CREATE TABLE "hotel_tasks" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "assignee_id" UUID,
    "department_id" UUID,
    "assign_type" "HotelTaskAssignType" NOT NULL DEFAULT 'DEPT',
    "status" "HotelTaskStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(180) NOT NULL,
    "title_de" VARCHAR(180) NOT NULL,
    "title_it" VARCHAR(180) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "note_de" TEXT NOT NULL DEFAULT '',
    "note_it" TEXT NOT NULL DEFAULT '',
    "due_at" DATE,
    "origin" VARCHAR(255),
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hotel_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_tasks_hotel_tenant_id_status_due_at_idx" ON "hotel_tasks"("hotel_tenant_id", "status", "due_at");
CREATE INDEX "hotel_tasks_created_by_id_idx" ON "hotel_tasks"("created_by_id");
CREATE INDEX "hotel_tasks_assignee_id_idx" ON "hotel_tasks"("assignee_id");
CREATE INDEX "hotel_tasks_department_id_idx" ON "hotel_tasks"("department_id");

ALTER TABLE "hotel_tasks" ADD CONSTRAINT "hotel_tasks_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_tasks" ADD CONSTRAINT "hotel_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_tasks" ADD CONSTRAINT "hotel_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hotel_tasks" ADD CONSTRAINT "hotel_tasks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
