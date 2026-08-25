import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const name = process.env.SUPER_ADMIN_NAME?.trim();
const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

if (!name) {
  throw new Error("SUPER_ADMIN_NAME is required to seed the database.");
}

if (!email) {
  throw new Error("SUPER_ADMIN_EMAIL is required to seed the database.");
}

if (!password || password.length < 12) {
  throw new Error("SUPER_ADMIN_PASSWORD must contain at least 12 characters.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(password!, 12);

  await prisma.superAdmin.upsert({
    where: { email },
    update: {
      name: name!,
      passwordHash,
      isActive: true,
    },
    create: {
      name: name!,
      email: email!,
      passwordHash,
    },
  });

  console.log(`Super admin seed completed for ${email}.`);
}

main()
  .catch((error) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
