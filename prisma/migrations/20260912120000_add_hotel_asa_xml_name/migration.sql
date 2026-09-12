-- Optional ASA XML filename for each hotel. No import is triggered by this migration.
ALTER TABLE "hotel_tenants" ADD COLUMN "asa_xml_name" VARCHAR(255);
