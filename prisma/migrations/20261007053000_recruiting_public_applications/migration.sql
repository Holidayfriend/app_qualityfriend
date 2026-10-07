ALTER TABLE "recruiting_applications" ADD COLUMN "via_public_page" BOOLEAN NOT NULL DEFAULT false;

-- Staff-created applications are written with an audit CREATE. Public form submissions are not.
UPDATE "recruiting_applications" AS application
SET "via_public_page" = true
WHERE NOT EXISTS (
  SELECT 1
  FROM "audit_logs" AS log
  WHERE log."entity_type" = 'RECRUITING_APPLICATION'
    AND log."action" = 'CREATE'
    AND log."entity_id" = application."id"
    AND log."hotel_tenant_id" = application."hotel_tenant_id"
);
