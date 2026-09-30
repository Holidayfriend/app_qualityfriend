BEGIN;

CREATE TABLE "hotel_roles" (
  "hotel_tenant_id" UUID NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "name_en" VARCHAR(180) NOT NULL,
  "name_de" VARCHAR(180) NOT NULL,
  "name_it" VARCHAR(180) NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_roles_pkey" PRIMARY KEY ("hotel_tenant_id", "key"),
  CONSTRAINT "hotel_roles_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "hotel_roles" ("hotel_tenant_id", "key", "name_en", "name_de", "name_it", "is_system")
SELECT h.id, r.key, r.en, r.de, r.it, true FROM "hotel_tenants" h CROSS JOIN (VALUES
  ('EMPLOYEE', 'Employee', 'Mitarbeiter', 'Dipendente'),
  ('TEAM_LEAD', 'Team/Department Lead', 'Team-/Abteilungsleitung', 'Responsabile team/reparto'),
  ('MANAGEMENT', 'Management', 'Management', 'Direzione'),
  ('ADMIN', 'Administrator', 'Administrator', 'Amministratore')
) AS r(key, en, de, it);

-- Keep every existing assignment and permission row; only widen the role key.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE VARCHAR(80) USING "role"::text;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
ALTER TABLE "role_module_permissions" ALTER COLUMN "role" TYPE VARCHAR(80) USING "role"::text;

-- A role from another hotel cannot be assigned, even through a direct DB write.
ALTER TABLE "users" ADD CONSTRAINT "users_hotel_tenant_id_role_fkey"
  FOREIGN KEY ("hotel_tenant_id", "role") REFERENCES "hotel_roles"("hotel_tenant_id", "key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_module_permissions" ADD CONSTRAINT "role_module_permissions_hotel_tenant_id_role_fkey"
  FOREIGN KEY ("hotel_tenant_id", "role") REFERENCES "hotel_roles"("hotel_tenant_id", "key") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
