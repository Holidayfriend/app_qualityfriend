CREATE TYPE "RecruitingEmailCategory" AS ENUM ('RECEIVED', 'OFFER', 'REJECT');

CREATE TABLE "recruiting_email_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_tenant_id" UUID NOT NULL,
    "category" "RecruitingEmailCategory" NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiting_email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruiting_email_templates_hotel_tenant_id_category_locale_key" ON "recruiting_email_templates"("hotel_tenant_id", "category", "locale");
CREATE INDEX "recruiting_email_templates_hotel_tenant_id_idx" ON "recruiting_email_templates"("hotel_tenant_id");

ALTER TABLE "recruiting_email_templates" ADD CONSTRAINT "recruiting_email_templates_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
