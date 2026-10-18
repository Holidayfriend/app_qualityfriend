ALTER TABLE "competitors" ADD COLUMN "best_value_rank" INTEGER;

CREATE INDEX "competitors_hotel_tenant_id_location_key_best_value_rank_idx"
ON "competitors"("hotel_tenant_id", "location_key", "best_value_rank");
