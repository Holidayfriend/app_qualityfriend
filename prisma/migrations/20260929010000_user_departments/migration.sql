CREATE TABLE "user_departments" (
  "user_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  CONSTRAINT "user_departments_pkey" PRIMARY KEY ("user_id", "department_id"),
  CONSTRAINT "user_departments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "user_departments_department_id_idx" ON "user_departments"("department_id");

INSERT INTO "user_departments" ("user_id", "department_id")
SELECT "id", "department_id" FROM "users" WHERE "department_id" IS NOT NULL;
