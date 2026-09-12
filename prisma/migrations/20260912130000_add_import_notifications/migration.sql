-- Review and apply manually. No migration commands were run by the agent.
ALTER TYPE "ImportRunStatus" ADD VALUE 'QUEUED';
ALTER TABLE "reservations" ADD COLUMN "source_present" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "users_hotel_tenant_id_id_key" ON "users"("hotel_tenant_id", "id");
CREATE TABLE "notifications" (
  "id" UUID NOT NULL PRIMARY KEY,
  "hotel_tenant_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "module_key" VARCHAR(80) NOT NULL,
  "required_scope" "PermissionScope" NOT NULL DEFAULT 'OWN',
  "event_key" VARCHAR(180) NOT NULL,
  "icon" VARCHAR(40) NOT NULL,
  "destination" VARCHAR(255) NOT NULL,
  "title_en" TEXT NOT NULL, "title_de" TEXT NOT NULL, "title_it" TEXT NOT NULL,
  "body_en" TEXT NOT NULL, "body_de" TEXT NOT NULL, "body_it" TEXT NOT NULL,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "notifications_hotel_tenant_id_recipient_id_fkey" FOREIGN KEY ("hotel_tenant_id", "recipient_id") REFERENCES "users"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notifications_hotel_tenant_id_recipient_id_event_key_key" ON "notifications"("hotel_tenant_id", "recipient_id", "event_key");
CREATE INDEX "notifications_hotel_tenant_id_recipient_id_read_at_created_at_idx" ON "notifications"("hotel_tenant_id", "recipient_id", "read_at", "created_at");
