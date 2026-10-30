CREATE TABLE "manual_file_blobs" (
    "storage_key" VARCHAR(80) NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "manual_file_blobs_pkey" PRIMARY KEY ("storage_key")
);
