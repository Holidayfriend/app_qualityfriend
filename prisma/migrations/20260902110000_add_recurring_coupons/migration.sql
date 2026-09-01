ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'COMPED';

CREATE TABLE "coupons" (
  "id" UUID NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "percent_off" INTEGER NOT NULL,
  "max_redemptions" INTEGER,
  "redemption_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupons_percent_check" CHECK ("percent_off" BETWEEN 1 AND 100),
  CONSTRAINT "coupons_limit_check" CHECK ("max_redemptions" IS NULL OR "max_redemptions" > 0)
);
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_is_active_expires_at_idx" ON "coupons"("is_active", "expires_at");

CREATE TABLE "coupon_redemptions" (
  "id" UUID NOT NULL,
  "coupon_id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "original_amount" DECIMAL(10,2) NOT NULL,
  "discounted_amount" DECIMAL(10,2) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "paypal_subscription_id" VARCHAR(128),
  "redeemed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "coupon_redemptions_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_hotel_tenant_id_key" ON "coupon_redemptions"("coupon_id", "hotel_tenant_id");
CREATE UNIQUE INDEX "coupon_redemptions_hotel_tenant_id_key" ON "coupon_redemptions"("hotel_tenant_id");
CREATE INDEX "coupon_redemptions_hotel_tenant_id_redeemed_at_idx" ON "coupon_redemptions"("hotel_tenant_id", "redeemed_at");
