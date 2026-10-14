CREATE TABLE "hotel_task_departments" (
    "task_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    CONSTRAINT "hotel_task_departments_pkey" PRIMARY KEY ("task_id", "department_id")
);

CREATE TABLE "hotel_checklist_departments" (
    "checklist_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    CONSTRAINT "hotel_checklist_departments_pkey" PRIMARY KEY ("checklist_id", "department_id")
);

CREATE INDEX "hotel_task_departments_department_id_idx" ON "hotel_task_departments"("department_id");
CREATE INDEX "hotel_checklist_departments_department_id_idx" ON "hotel_checklist_departments"("department_id");

ALTER TABLE "hotel_task_departments" ADD CONSTRAINT "hotel_task_departments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "hotel_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_task_departments" ADD CONSTRAINT "hotel_task_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_checklist_departments" ADD CONSTRAINT "hotel_checklist_departments_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "hotel_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_checklist_departments" ADD CONSTRAINT "hotel_checklist_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "hotel_task_departments" ("task_id", "department_id")
SELECT "id", "department_id"
FROM "hotel_tasks"
WHERE "assign_type" = 'DEPT' AND "department_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "hotel_checklist_departments" ("checklist_id", "department_id")
SELECT "id", "department_id"
FROM "hotel_checklists"
WHERE "assign_type" = 'DEPT' AND "department_id" IS NOT NULL
ON CONFLICT DO NOTHING;
