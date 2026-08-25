CREATE TYPE "UserRole_without_owner" AS ENUM ('EMPLOYEE', 'TEAM_LEAD', 'MANAGEMENT', 'ADMIN');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "role_module_permissions" ALTER COLUMN "role" TYPE TEXT;
UPDATE "users" SET "role" = 'ADMIN' WHERE "role"::text = 'OWNER';
DELETE FROM "role_module_permissions" WHERE "role" = 'OWNER';
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_without_owner" USING "role"::text::"UserRole_without_owner";
ALTER TABLE "role_module_permissions" ALTER COLUMN "role" TYPE "UserRole_without_owner" USING "role"::"UserRole_without_owner";
DROP TYPE "UserRole";
ALTER TYPE "UserRole_without_owner" RENAME TO "UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
