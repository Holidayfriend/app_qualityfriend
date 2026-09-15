CREATE TABLE "recruiting_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_tenant_id" UUID NOT NULL,
    "subdomain" VARCHAR(63),
    "reply_email" VARCHAR(320) NOT NULL DEFAULT '',
    "email_logo" VARCHAR(255) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiting_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruiting_settings_hotel_tenant_id_key" ON "recruiting_settings"("hotel_tenant_id");
CREATE UNIQUE INDEX "recruiting_settings_subdomain_key" ON "recruiting_settings"("subdomain");

ALTER TABLE "recruiting_settings" ADD CONSTRAINT "recruiting_settings_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
