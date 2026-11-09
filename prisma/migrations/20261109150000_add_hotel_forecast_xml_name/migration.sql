-- Optional forecast XML filename for each hotel. No import is triggered by this migration.
ALTER TABLE "hotel_tenants" ADD COLUMN "forecast_xml_name" VARCHAR(255);
