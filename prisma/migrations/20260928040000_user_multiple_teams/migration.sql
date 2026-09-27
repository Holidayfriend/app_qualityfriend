CREATE TABLE "user_teams" (
  "user_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  CONSTRAINT "user_teams_pkey" PRIMARY KEY ("user_id", "team_id"),
  CONSTRAINT "user_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "user_teams_team_id_idx" ON "user_teams"("team_id");

INSERT INTO "user_teams" ("user_id", "team_id")
SELECT "id", "team_id" FROM "users" WHERE "team_id" IS NOT NULL;
