-- CreateEnum
CREATE TYPE "RepairKind" AS ENUM ('REPAIR', 'TEMPLATE');
CREATE TYPE "RepairTicketStatus" AS ENUM ('NEU', 'UEBERNOMMEN', 'IN_ARBEIT', 'WARTET', 'ERLEDIGT');
CREATE TYPE "RepairVisibility" AS ENUM ('ALL', 'DEPARTMENT');

-- CreateTable
CREATE TABLE "repairs" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "assignee_id" UUID,
    "kind" "RepairKind" NOT NULL DEFAULT 'REPAIR',
    "status" "RepairTicketStatus" NOT NULL DEFAULT 'NEU',
    "visibility" "RepairVisibility" NOT NULL DEFAULT 'ALL',
    "location_key" VARCHAR(180) NOT NULL,
    "location" VARCHAR(180) NOT NULL,
    "location_de" VARCHAR(180) NOT NULL,
    "location_it" VARCHAR(180) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "title_de" VARCHAR(180) NOT NULL,
    "title_it" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "description_de" TEXT NOT NULL,
    "description_it" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags_de" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags_it" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "repairs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "repair_share_departments" (
    "repair_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    CONSTRAINT "repair_share_departments_pkey" PRIMARY KEY ("repair_id","department_id")
);

CREATE TABLE "repair_comments" (
    "id" UUID NOT NULL,
    "repair_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "text_de" TEXT NOT NULL,
    "text_it" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repair_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "repairs_hotel_tenant_id_kind_status_created_at_idx" ON "repairs"("hotel_tenant_id", "kind", "status", "created_at");
CREATE INDEX "repairs_created_by_id_idx" ON "repairs"("created_by_id");
CREATE INDEX "repairs_assignee_id_idx" ON "repairs"("assignee_id");
CREATE INDEX "repair_share_departments_department_id_idx" ON "repair_share_departments"("department_id");
CREATE INDEX "repair_comments_repair_id_created_at_idx" ON "repair_comments"("repair_id", "created_at");
CREATE INDEX "repair_comments_author_id_idx" ON "repair_comments"("author_id");

ALTER TABLE "repairs" ADD CONSTRAINT "repairs_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "repair_share_departments" ADD CONSTRAINT "repair_share_departments_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repair_share_departments" ADD CONSTRAINT "repair_share_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repair_comments" ADD CONSTRAINT "repair_comments_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repair_comments" ADD CONSTRAINT "repair_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
