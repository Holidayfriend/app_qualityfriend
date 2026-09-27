ALTER TABLE "users" ADD COLUMN "password_reset_token_hash" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ(3);

CREATE INDEX "users_password_reset_token_hash_idx" ON "users"("password_reset_token_hash");
