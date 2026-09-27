ALTER TABLE "hotel_tenants" ADD COLUMN "welcome_email_sent_at" TIMESTAMPTZ(3);

-- Hotels that already paid should not receive another welcome email.
UPDATE "hotel_tenants"
SET "welcome_email_sent_at" = NOW()
WHERE "subscription_status" IN ('ACTIVE', 'COMPED');
