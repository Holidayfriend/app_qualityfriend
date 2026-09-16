import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";

/**
 * Prisma client for CLI/worker scripts.
 * Unlike `lib/prisma.ts`, this does not import `server-only`, so `tsx` scripts can use it.
 */
export function createJobPrisma(max = 2) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}
