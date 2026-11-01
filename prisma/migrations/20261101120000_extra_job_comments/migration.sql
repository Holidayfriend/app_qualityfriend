CREATE TABLE IF NOT EXISTS "housekeeping_extra_job_comments" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "housekeeping_extra_job_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "housekeeping_extra_job_comments_assignment_id_created_at_idx" ON "housekeeping_extra_job_comments"("assignment_id", "created_at");
CREATE INDEX IF NOT EXISTS "housekeeping_extra_job_comments_hotel_tenant_id_author_id_idx" ON "housekeeping_extra_job_comments"("hotel_tenant_id", "author_id");

DO $$ BEGIN
  ALTER TABLE "housekeeping_extra_job_comments" ADD CONSTRAINT "hk_extra_comment_tenant_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "housekeeping_extra_job_comments" ADD CONSTRAINT "hk_extra_comment_assignment_fkey" FOREIGN KEY ("assignment_id") REFERENCES "housekeeping_extra_job_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "housekeeping_extra_job_comments" ADD CONSTRAINT "hk_extra_comment_author_fkey" FOREIGN KEY ("hotel_tenant_id", "author_id") REFERENCES "users"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
