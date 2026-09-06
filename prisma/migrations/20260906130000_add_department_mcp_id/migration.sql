ALTER TABLE "departments"
  ADD COLUMN "mcp_department_id" VARCHAR(128);

CREATE INDEX "departments_mcp_department_id_idx" ON "departments"("mcp_department_id");
