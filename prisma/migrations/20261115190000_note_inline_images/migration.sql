CREATE TABLE "note_inline_images" (
    "hotel_tenant_id" UUID NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_inline_images_pkey" PRIMARY KEY ("hotel_tenant_id", "storage_key")
);
