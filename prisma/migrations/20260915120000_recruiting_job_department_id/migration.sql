ALTER TABLE "recruiting_jobs" ADD COLUMN "department_id" UUID;

UPDATE "recruiting_jobs" AS job
SET "department_id" = dept.id
FROM (
    SELECT DISTINCT ON ("hotel_tenant_id") "id", "hotel_tenant_id"
    FROM "departments"
    WHERE "is_deleted" = false
    ORDER BY "hotel_tenant_id", "name_en" ASC
) AS dept
WHERE job."hotel_tenant_id" = dept."hotel_tenant_id";

DELETE FROM "recruiting_jobs" WHERE "department_id" IS NULL;

ALTER TABLE "recruiting_jobs" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "recruiting_jobs" DROP COLUMN "department";
ALTER TABLE "recruiting_jobs" ADD CONSTRAINT "recruiting_jobs_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "recruiting_jobs_department_id_idx" ON "recruiting_jobs"("department_id");
