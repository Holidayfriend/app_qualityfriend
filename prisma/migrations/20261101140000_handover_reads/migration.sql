CREATE TABLE IF NOT EXISTS "handover_reads" (
    "handover_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "handover_reads_pkey" PRIMARY KEY ("handover_id","user_id")
);

CREATE INDEX IF NOT EXISTS "handover_reads_user_id_idx" ON "handover_reads"("user_id");

DO $$ BEGIN
  ALTER TABLE "handover_reads" ADD CONSTRAINT "hk_handover_read_handover_fkey" FOREIGN KEY ("handover_id") REFERENCES "handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "handover_reads" ADD CONSTRAINT "hk_handover_read_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
