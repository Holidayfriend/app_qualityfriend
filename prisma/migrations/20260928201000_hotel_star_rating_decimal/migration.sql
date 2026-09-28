ALTER TABLE "hotel_tenants" ALTER COLUMN "star_rating" TYPE DECIMAL(3,1) USING "star_rating"::DECIMAL(3,1);
