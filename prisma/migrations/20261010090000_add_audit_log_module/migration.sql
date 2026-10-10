ALTER TABLE "audit_logs" ADD COLUMN "module" VARCHAR(40);

UPDATE "audit_logs"
SET "module" = CASE
  WHEN "entity_type" LIKE 'RECRUITING_%' THEN 'recruiting'
  WHEN "entity_type" IN ('SHIFT_TEMPLATE', 'SHIFT', 'SHIFT_DRAFT', 'LEAVE_REQUEST', 'SWAP_REQUEST') THEN 'schedule'
  WHEN "entity_type" IN ('NOTE', 'NOTE_TEMPLATE') THEN 'notes'
  WHEN "entity_type" = 'MANUAL' THEN 'manuals'
  WHEN "entity_type" IN ('REPAIR', 'REPAIR_TEMPLATE') THEN 'repairs'
  WHEN "entity_type" IN ('HANDOVER', 'HANDOVER_TEMPLATE') THEN 'handovers'
  WHEN "entity_type" IN ('TASK', 'CHECKLIST', 'CHECKLIST_TEMPLATE') THEN 'tasks'
  WHEN "entity_type" IN ('HOUSEKEEPING_IMPORT', 'HOUSEKEEPING_CHECK', 'ROOM', 'ROOM_CATEGORY', 'FLOOR', 'EXTRA_JOB') THEN 'housekeeping'
  ELSE 'settings'
END;

ALTER TABLE "audit_logs" ALTER COLUMN "module" SET NOT NULL;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_module_check"
  CHECK ("module" IN ('settings', 'manuals', 'recruiting', 'revenue', 'schedule', 'notes', 'repairs', 'housekeeping', 'tasks', 'handovers'));

CREATE INDEX "audit_logs_hotel_tenant_id_module_created_at_idx"
  ON "audit_logs"("hotel_tenant_id", "module", "created_at");
