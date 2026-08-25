-- CreateEnum
CREATE TYPE "HotelLanguage" AS ENUM ('EN', 'DE', 'IT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'USER');

-- CreateTable
CREATE TABLE "hotel_tenants" (
    "id" UUID NOT NULL,
    "hotel_name_en" VARCHAR(180) NOT NULL,
    "hotel_name_de" VARCHAR(180) NOT NULL,
    "hotel_name_it" VARCHAR(180) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "logo_url" VARCHAR(2048),
    "hotel_language" "HotelLanguage" NOT NULL DEFAULT 'EN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "data_protection_en" TEXT,
    "data_protection_de" TEXT,
    "data_protection_it" TEXT,
    "privacy_policy_en" TEXT,
    "privacy_policy_de" TEXT,
    "privacy_policy_it" TEXT,
    "company_name" VARCHAR(180) NOT NULL,
    "street_address" VARCHAR(255) NOT NULL,
    "postal_code" VARCHAR(32) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "country" VARCHAR(120) NOT NULL,
    "contact_person" VARCHAR(180) NOT NULL,
    "phone_number" VARCHAR(40),
    "vat_id" VARCHAR(64),
    "tripadvisor_id" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hotel_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(40),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_tenants_is_active_idx" ON "hotel_tenants"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_hotel_tenant_id_idx" ON "users"("hotel_tenant_id");

-- CreateIndex
CREATE INDEX "users_hotel_tenant_id_is_active_idx" ON "users"("hotel_tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
