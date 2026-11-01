ALTER TABLE "housekeeping_extra_job_assignments" ADD COLUMN IF NOT EXISTS "comment" VARCHAR(2000) NOT NULL DEFAULT '';
