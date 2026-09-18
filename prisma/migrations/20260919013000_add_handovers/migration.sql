CREATE TYPE "HandoverKind" AS ENUM ('HANDOVER', 'TEMPLATE');
CREATE TYPE "HandoverStatus" AS ENUM ('OPEN', 'DONE', 'DRAFT');
CREATE TYPE "HandoverVisibility" AS ENUM ('ALL', 'DEPARTMENT', 'PRIVATE');

CREATE TABLE "handovers" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "kind" "HandoverKind" NOT NULL DEFAULT 'HANDOVER',
    "status" "HandoverStatus" NOT NULL DEFAULT 'OPEN',
    "visibility" "HandoverVisibility" NOT NULL DEFAULT 'ALL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "handover_share_departments" (
    "handover_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    CONSTRAINT "handover_share_departments_pkey" PRIMARY KEY ("handover_id","department_id")
);

CREATE INDEX "handovers_hotel_tenant_id_kind_status_pinned_created_at_idx" ON "handovers"("hotel_tenant_id", "kind", "status", "pinned", "created_at");
CREATE INDEX "handovers_created_by_id_idx" ON "handovers"("created_by_id");
CREATE INDEX "handover_share_departments_department_id_idx" ON "handover_share_departments"("department_id");

ALTER TABLE "handovers" ADD CONSTRAINT "handovers_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "handover_share_departments" ADD CONSTRAINT "handover_share_departments_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "handover_share_departments" ADD CONSTRAINT "handover_share_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
