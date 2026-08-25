import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma=globalThis as typeof globalThis&{qualityfriendPrisma?:PrismaClient};
function createClient(){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error("DATABASE_URL is not configured.");return new PrismaClient({adapter:new PrismaPg({connectionString})})}
export const prisma=globalForPrisma.qualityfriendPrisma??createClient();
if(process.env.NODE_ENV!=="production")globalForPrisma.qualityfriendPrisma=prisma;
