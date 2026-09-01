CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'APPROVAL_PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PaymentProvider" AS ENUM ('PAYPAL');

ALTER TABLE "hotel_tenants"
ADD COLUMN "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "paypal_subscription_id" VARCHAR(128),
ADD COLUMN "paypal_plan_id" VARCHAR(128),
ADD COLUMN "subscription_started_at" TIMESTAMPTZ(3),
ADD COLUMN "subscription_current_period_end" TIMESTAMPTZ(3),
ADD COLUMN "subscription_cancelled_at" TIMESTAMPTZ(3);

-- Existing hotels keep access. Hotels registered after this migration start pending.
ALTER TABLE "hotel_tenants" ALTER COLUMN "subscription_status" SET DEFAULT 'PENDING';
CREATE UNIQUE INDEX "hotel_tenants_paypal_subscription_id_key" ON "hotel_tenants"("paypal_subscription_id");

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPAL',
  "provider_subscription_id" VARCHAR(128) NOT NULL,
  "provider_plan_id" VARCHAR(128) NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'APPROVAL_PENDING',
  "payer_email" VARCHAR(320),
  "started_at" TIMESTAMPTZ(3),
  "next_billing_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");
CREATE INDEX "subscriptions_hotel_tenant_id_status_idx" ON "subscriptions"("hotel_tenant_id", "status");

CREATE TABLE "payment_events" (
  "id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPAL',
  "provider_event_id" VARCHAR(128) NOT NULL,
  "event_type" VARCHAR(160) NOT NULL,
  "hotel_tenant_id" UUID,
  "payload" JSONB NOT NULL,
  "processed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_events_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events"("provider_event_id");
CREATE INDEX "payment_events_hotel_tenant_id_created_at_idx" ON "payment_events"("hotel_tenant_id", "created_at");
CREATE INDEX "payment_events_event_type_created_at_idx" ON "payment_events"("event_type", "created_at");
