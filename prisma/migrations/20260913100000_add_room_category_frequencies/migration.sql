-- Apply with the project's normal Prisma migration deployment process.
ALTER TABLE "room_categories"
  ADD COLUMN "cleaning_frequency" VARCHAR(30),
  ADD COLUMN "linen_frequency" VARCHAR(30);
