ALTER TABLE "room_categories"
    ADD COLUMN "cleaning_weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "room_categories"
    ADD CONSTRAINT "room_categories_cleaning_weekdays_check"
    CHECK ("cleaning_weekdays" <@ ARRAY[1,2,3,4,5,6,7]::INTEGER[]);
