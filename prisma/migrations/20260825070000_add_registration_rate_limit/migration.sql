CREATE TABLE "registration_rate_limits" (
    "id" UUID NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_rate_limits_key_hash_window_start_key"
ON "registration_rate_limits"("key_hash", "window_start");

CREATE INDEX "registration_rate_limits_expires_at_idx"
ON "registration_rate_limits"("expires_at");
