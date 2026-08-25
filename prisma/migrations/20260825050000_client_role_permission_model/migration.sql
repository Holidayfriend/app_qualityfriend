CREATE TYPE "UserRole_new" AS ENUM ('OWNER', 'EMPLOYEE', 'TEAM_LEAD', 'MANAGEMENT', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (CASE WHEN "role"::text = 'USER' THEN 'EMPLOYEE' ELSE "role"::text END)::"UserRole_new";
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';

CREATE TYPE "PermissionScope" AS ENUM ('OWN', 'DEPARTMENT', 'ALL');
ALTER TABLE "users" ADD COLUMN "department_id" UUID;

CREATE TABLE "role_module_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_tenant_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "module_key" VARCHAR(80) NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_update" BOOLEAN NOT NULL DEFAULT false,
    "can_change_status" BOOLEAN NOT NULL DEFAULT false,
    "can_assign" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "scope" "PermissionScope" NOT NULL DEFAULT 'OWN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_module_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permission_departments" (
    "permission_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    CONSTRAINT "role_permission_departments_pkey" PRIMARY KEY ("permission_id", "department_id")
);

CREATE INDEX "users_department_id_idx" ON "users"("department_id");
CREATE UNIQUE INDEX "role_module_permissions_hotel_tenant_id_role_module_key_key" ON "role_module_permissions"("hotel_tenant_id", "role", "module_key");
CREATE INDEX "role_module_permissions_hotel_tenant_id_role_idx" ON "role_module_permissions"("hotel_tenant_id", "role");
CREATE INDEX "role_permission_departments_department_id_idx" ON "role_permission_departments"("department_id");

ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_module_permissions" ADD CONSTRAINT "role_module_permissions_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permission_departments" ADD CONSTRAINT "role_permission_departments_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "role_module_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permission_departments" ADD CONSTRAINT "role_permission_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
