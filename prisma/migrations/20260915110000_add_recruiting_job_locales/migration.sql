ALTER TABLE "recruiting_jobs"
    ADD COLUMN "title_de" VARCHAR(180) NOT NULL DEFAULT '',
    ADD COLUMN "title_it" VARCHAR(180) NOT NULL DEFAULT '',
    ADD COLUMN "description_de" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "description_it" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "auto_message_de" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "auto_message_it" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "location_de" VARCHAR(180) NOT NULL DEFAULT '',
    ADD COLUMN "location_it" VARCHAR(180) NOT NULL DEFAULT '';

UPDATE "recruiting_jobs" SET
    "title_de" = "title",
    "title_it" = "title",
    "description_de" = "description",
    "description_it" = "description",
    "auto_message_de" = "auto_message",
    "auto_message_it" = "auto_message",
    "location_de" = "location",
    "location_it" = "location";
