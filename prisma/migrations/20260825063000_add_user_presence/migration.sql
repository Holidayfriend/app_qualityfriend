ALTER TABLE "users" ADD COLUMN "last_seen_at" TIMESTAMPTZ(3);
CREATE INDEX "users_hotel_tenant_id_last_seen_at_idx" ON "users"("hotel_tenant_id", "last_seen_at");
