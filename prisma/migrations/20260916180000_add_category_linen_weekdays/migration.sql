ALTER TABLE "room_categories"
    ADD COLUMN "linen_weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "room_categories"
    ADD CONSTRAINT "room_categories_linen_weekdays_check"
    CHECK ("linen_weekdays" <@ ARRAY[1,2,3,4,5,6,7]::INTEGER[]);
