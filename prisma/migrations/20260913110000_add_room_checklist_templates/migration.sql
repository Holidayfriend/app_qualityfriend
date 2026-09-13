-- Reusable room checklist templates. Daily checklist completion records will reference
-- these templates in a later housekeeping-assignment flow.
CREATE TABLE "room_checklist_templates" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "room_checks_en" JSONB NOT NULL,
  "room_checks_de" JSONB NOT NULL,
  "room_checks_it" JSONB NOT NULL,
  "arrival_checks_en" JSONB NOT NULL,
  "arrival_checks_de" JSONB NOT NULL,
  "arrival_checks_it" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "room_checklist_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_checklist_templates_room_id_key" UNIQUE ("room_id"),
  CONSTRAINT "room_checklist_templates_hotel_tenant_id_id_key" UNIQUE ("hotel_tenant_id", "id"),
  CONSTRAINT "room_checklist_templates_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "room_checklist_templates_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
