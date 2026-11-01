import { prisma } from "../prisma";

let ready: Promise<void> | null = null;

const statements = [
  `ALTER TABLE "housekeeping_extra_job_assignments" ADD COLUMN IF NOT EXISTS "comment" VARCHAR(2000) NOT NULL DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS "housekeeping_extra_job_comments" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "housekeeping_extra_job_comments_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "housekeeping_extra_job_comments_assignment_id_created_at_idx" ON "housekeeping_extra_job_comments"("assignment_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "housekeeping_extra_job_comments_hotel_tenant_id_author_id_idx" ON "housekeeping_extra_job_comments"("hotel_tenant_id", "author_id")`,
];

export function ensureExtraJobComment() {
  ready ??= (async () => {
    for (const statement of statements) await prisma.$executeRawUnsafe(statement);
  })().then(() => undefined).catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}
