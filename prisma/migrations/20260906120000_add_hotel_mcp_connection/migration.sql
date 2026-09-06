ALTER TABLE "hotel_tenants"
  ADD COLUMN "active_mcp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mcp_hotel_id" VARCHAR(128),
  ADD COLUMN "mcp_user_email" VARCHAR(320),
  ADD COLUMN "mcp_user_password" VARCHAR(255),
  ADD COLUMN "mcp_user_department" VARCHAR(128);

CREATE INDEX "hotel_tenants_active_mcp_idx" ON "hotel_tenants"("active_mcp");
