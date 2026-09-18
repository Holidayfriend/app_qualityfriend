CREATE TABLE IF NOT EXISTS "hotel_ai_settings" (
  "hotel_tenant_id" UUID NOT NULL,
  "active_provider" VARCHAR(40) NOT NULL DEFAULT 'openai',
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_ai_settings_pkey" PRIMARY KEY ("hotel_tenant_id")
);

CREATE TABLE IF NOT EXISTS "hotel_ai_provider_credentials" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "model" VARCHAR(80) NOT NULL,
  "api_key_encrypted" TEXT NOT NULL DEFAULT '',
  "api_key_last4" VARCHAR(8) NOT NULL DEFAULT '',
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_ai_provider_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hotel_ai_provider_credentials_hotel_tenant_id_provider_key"
  ON "hotel_ai_provider_credentials"("hotel_tenant_id", "provider");

CREATE INDEX IF NOT EXISTS "hotel_ai_provider_credentials_hotel_tenant_id_idx"
  ON "hotel_ai_provider_credentials"("hotel_tenant_id");
