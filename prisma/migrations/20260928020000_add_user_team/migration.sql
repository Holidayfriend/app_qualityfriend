ALTER TABLE "users" ADD COLUMN "team_id" UUID;

CREATE INDEX "users_team_id_idx" ON "users"("team_id");

ALTER TABLE "users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
