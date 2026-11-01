import "server-only";

import { prisma } from "../prisma";

let ready: Promise<void> | null = null;

export function ensureChecklistDueTime() {
  ready ??= prisma.$executeRawUnsafe(
    `ALTER TABLE "hotel_checklists" ADD COLUMN IF NOT EXISTS "due_time" VARCHAR(5) NOT NULL DEFAULT ''`,
  ).then(() => undefined).catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}
