CREATE TABLE "billing_configurations" (
  "id" VARCHAR(32) NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPAL',
  "environment" VARCHAR(16) NOT NULL DEFAULT 'sandbox',
  "product_id" VARCHAR(128),
  "plan_id" VARCHAR(128),
  "product_name" VARCHAR(127) NOT NULL DEFAULT 'QualityFriend Hotel Operations',
  "plan_name" VARCHAR(127) NOT NULL DEFAULT 'QualityFriend Monthly',
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "monthly_price" DECIMAL(10,2) NOT NULL DEFAULT 39.00,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "billing_configurations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "billing_configurations" (
  "id", "environment", "product_id", "plan_id", "monthly_price", "updated_at"
) VALUES (
  'paypal_sandbox',
  COALESCE(NULLIF(current_setting('app.paypal_environment', true), ''), 'sandbox'),
  NULL,
  NULL,
  39.00,
  CURRENT_TIMESTAMP
);
