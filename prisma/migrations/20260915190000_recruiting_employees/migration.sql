CREATE TYPE "RecruitingEmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "RecruitingInactiveReason" AS ENUM ('PENSION', 'RESIGNATION');

CREATE TABLE "recruiting_employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_tenant_id" UUID NOT NULL,
    "application_id" UUID,
    "department_id" UUID NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL DEFAULT '',
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "tax_id" VARCHAR(64) NOT NULL DEFAULT '',
    "birthdate" DATE,
    "birthplace" VARCHAR(180) NOT NULL DEFAULT '',
    "employed_from" DATE,
    "employed_to" DATE,
    "status" "RecruitingEmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "inactive_reason" "RecruitingInactiveReason",
    "comments" TEXT NOT NULL DEFAULT '',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "certificates" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiting_employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruiting_employees_application_id_key" ON "recruiting_employees"("application_id");
CREATE UNIQUE INDEX "recruiting_employees_hotel_tenant_id_id_key" ON "recruiting_employees"("hotel_tenant_id", "id");
CREATE INDEX "recruiting_employees_hotel_tenant_id_status_idx" ON "recruiting_employees"("hotel_tenant_id", "status");
CREATE INDEX "recruiting_employees_department_id_idx" ON "recruiting_employees"("department_id");

ALTER TABLE "recruiting_employees" ADD CONSTRAINT "recruiting_employees_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recruiting_employees" ADD CONSTRAINT "recruiting_employees_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "recruiting_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruiting_employees" ADD CONSTRAINT "recruiting_employees_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
