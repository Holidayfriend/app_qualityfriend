ALTER TABLE "payment_events"
ADD COLUMN "provider_transaction_id" VARCHAR(128),
ADD COLUMN "amount" DECIMAL(12,2),
ADD COLUMN "currency_code" VARCHAR(3),
ADD COLUMN "transaction_at" TIMESTAMPTZ(3);

-- Backfill PayPal payment webhooks already received before these columns existed.
UPDATE "payment_events"
SET
  "provider_transaction_id" = "payload"->'resource'->>'id',
  "amount" = CASE
    WHEN COALESCE("payload"->'resource'->'amount'->>'total', "payload"->'resource'->'amount'->>'value', '') ~ '^[-]?[0-9]+([.][0-9]{1,2})?$'
    THEN COALESCE("payload"->'resource'->'amount'->>'total', "payload"->'resource'->'amount'->>'value')::DECIMAL(12,2)
    ELSE NULL
  END,
  "currency_code" = LEFT(UPPER(COALESCE("payload"->'resource'->'amount'->>'currency', "payload"->'resource'->'amount'->>'currency_code')), 3),
  "transaction_at" = CASE
    WHEN COALESCE("payload"->'resource'->>'create_time', "payload"->'resource'->>'update_time', '') <> ''
    THEN COALESCE("payload"->'resource'->>'create_time', "payload"->'resource'->>'update_time')::TIMESTAMPTZ
    ELSE "created_at"
  END
WHERE "event_type" LIKE 'PAYMENT.SALE.%';

CREATE INDEX "payment_events_transaction_at_idx" ON "payment_events"("transaction_at");
CREATE INDEX "payment_events_provider_transaction_id_idx" ON "payment_events"("provider_transaction_id");
