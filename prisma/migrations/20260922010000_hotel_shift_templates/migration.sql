CREATE TABLE "hotel_shift_templates" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "name_de" VARCHAR(180) NOT NULL,
    "name_it" VARCHAR(180) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "note_de" TEXT NOT NULL DEFAULT '',
    "note_it" TEXT NOT NULL DEFAULT '',
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hotel_shift_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_shift_templates_hotel_tenant_id_name_idx" ON "hotel_shift_templates"("hotel_tenant_id", "name");
CREATE INDEX "hotel_shift_templates_created_by_id_idx" ON "hotel_shift_templates"("created_by_id");

ALTER TABLE "hotel_shift_templates" ADD CONSTRAINT "hotel_shift_templates_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_shift_templates" ADD CONSTRAINT "hotel_shift_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
