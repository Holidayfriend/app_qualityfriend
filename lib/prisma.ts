import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & { qualityfriendPrisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getPrisma() {
  if (!globalForPrisma.qualityfriendPrisma) globalForPrisma.qualityfriendPrisma = createClient();
  return globalForPrisma.qualityfriendPrisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, property, receiver);
    if (typeof value === "function") return value.bind(client);
    return value;
  },
});
