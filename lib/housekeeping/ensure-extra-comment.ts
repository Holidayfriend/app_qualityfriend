import { prisma } from "../prisma";

let ready: Promise<void> | null = null;

export function ensureExtraJobComment() {
  ready ??= prisma.$executeRawUnsafe(
    `ALTER TABLE "housekeeping_extra_job_assignments" ADD COLUMN IF NOT EXISTS "comment" VARCHAR(2000) NOT NULL DEFAULT ''`,
  ).then(() => undefined).catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}
