CREATE TABLE "hotel_shifts" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "template_id" UUID,
    "work_date" DATE NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL DEFAULT '',
    "end_time" VARCHAR(5) NOT NULL DEFAULT '',
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "note_de" TEXT NOT NULL DEFAULT '',
    "note_it" TEXT NOT NULL DEFAULT '',
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hotel_shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hotel_shifts_hotel_tenant_id_user_id_work_date_key" ON "hotel_shifts"("hotel_tenant_id", "user_id", "work_date");
CREATE INDEX "hotel_shifts_hotel_tenant_id_work_date_idx" ON "hotel_shifts"("hotel_tenant_id", "work_date");
CREATE INDEX "hotel_shifts_user_id_work_date_idx" ON "hotel_shifts"("user_id", "work_date");
CREATE INDEX "hotel_shifts_created_by_id_idx" ON "hotel_shifts"("created_by_id");
CREATE INDEX "hotel_shifts_template_id_idx" ON "hotel_shifts"("template_id");

ALTER TABLE "hotel_shifts" ADD CONSTRAINT "hotel_shifts_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_shifts" ADD CONSTRAINT "hotel_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_shifts" ADD CONSTRAINT "hotel_shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hotel_shifts" ADD CONSTRAINT "hotel_shifts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "hotel_shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
