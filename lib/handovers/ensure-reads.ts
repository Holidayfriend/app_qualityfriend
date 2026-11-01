import { prisma } from "../prisma";

let ready: Promise<void> | null = null;

const statements = [
  `CREATE TABLE IF NOT EXISTS "handover_reads" (
    "handover_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "handover_reads_pkey" PRIMARY KEY ("handover_id","user_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "handover_reads_user_id_idx" ON "handover_reads"("user_id")`,
];

export function ensureHandoverReads() {
  ready ??= (async () => {
    for (const statement of statements) await prisma.$executeRawUnsafe(statement);
  })().then(() => undefined).catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}
