ALTER TABLE "users"
  ADD COLUMN "mcp_user_id" VARCHAR(128),
  ADD COLUMN "mcp_user_password" VARCHAR(255);

CREATE INDEX "users_mcp_user_id_idx" ON "users"("mcp_user_id");
