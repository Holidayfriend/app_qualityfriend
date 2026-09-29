ALTER TABLE "hotel_tenants"
  ALTER COLUMN "star_rating" TYPE VARCHAR(8)
  USING (
    CASE
      WHEN "star_rating" IS NULL THEN NULL
      WHEN "star_rating" = trunc("star_rating") AND "star_rating" BETWEEN 1 AND 5 THEN trunc("star_rating")::int::text
      ELSE NULL
    END
  );
