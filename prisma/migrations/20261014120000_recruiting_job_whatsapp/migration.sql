ALTER TABLE "recruiting_jobs"
ADD COLUMN "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsapp_number" VARCHAR(32) NOT NULL DEFAULT '';
