import "server-only";

import { prisma } from "../prisma";

let ready: Promise<void> | null = null;

export function ensureManualDeletedColumn() {
  ready ??= prisma.$executeRawUnsafe(
    `ALTER TABLE "manual_documents" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false`,
  ).then(() => prisma.$executeRawUnsafe(
    `ALTER TABLE "manual_documents" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(3)`,
  )).then(() => undefined).catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}
