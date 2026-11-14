CREATE TYPE "HotelCreationSource" AS ENUM ('PUBLIC', 'ADMIN');

ALTER TABLE "hotel_tenants"
ADD COLUMN "creation_source" "HotelCreationSource" NOT NULL DEFAULT 'PUBLIC';
