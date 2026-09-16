ALTER TABLE "room_operational_states"
  ADD COLUMN IF NOT EXISTS "linen_change" BOOLEAN NOT NULL DEFAULT false;
