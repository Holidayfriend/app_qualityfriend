CREATE TYPE "HotelNoteKind" AS ENUM ('NOTE', 'TEMPLATE');
CREATE TYPE "HotelNoteStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');
CREATE TYPE "HotelNoteVisibility" AS ENUM ('ALL', 'DEPARTMENT', 'USER', 'PRIVATE');

CREATE TABLE "hotel_notes" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "kind" "HotelNoteKind" NOT NULL DEFAULT 'NOTE',
    "status" "HotelNoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "HotelNoteVisibility" NOT NULL DEFAULT 'ALL',
    "title" VARCHAR(180) NOT NULL,
    "title_de" VARCHAR(180) NOT NULL,
    "title_it" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "description_de" TEXT NOT NULL,
    "description_it" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tags_de" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tags_it" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hotel_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_notes_hotel_tenant_id_kind_status_created_at_idx" ON "hotel_notes"("hotel_tenant_id", "kind", "status", "created_at");
CREATE INDEX "hotel_notes_created_by_id_idx" ON "hotel_notes"("created_by_id");

ALTER TABLE "hotel_notes" ADD CONSTRAINT "hotel_notes_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_notes" ADD CONSTRAINT "hotel_notes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "hotel_note_share_departments" (
    "note_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "hotel_note_share_departments_pkey" PRIMARY KEY ("note_id", "department_id")
);

CREATE INDEX "hotel_note_share_departments_department_id_idx" ON "hotel_note_share_departments"("department_id");

ALTER TABLE "hotel_note_share_departments" ADD CONSTRAINT "hotel_note_share_departments_note_id_fkey"
    FOREIGN KEY ("note_id") REFERENCES "hotel_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_note_share_departments" ADD CONSTRAINT "hotel_note_share_departments_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hotel_note_share_users" (
    "note_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "hotel_note_share_users_pkey" PRIMARY KEY ("note_id", "user_id")
);

CREATE INDEX "hotel_note_share_users_user_id_idx" ON "hotel_note_share_users"("user_id");

ALTER TABLE "hotel_note_share_users" ADD CONSTRAINT "hotel_note_share_users_note_id_fkey"
    FOREIGN KEY ("note_id") REFERENCES "hotel_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_note_share_users" ADD CONSTRAINT "hotel_note_share_users_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hotel_note_attachments" (
    "id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "file_name" VARCHAR(180) NOT NULL,
    "storage_key" VARCHAR(80) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_note_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_note_attachments_note_id_idx" ON "hotel_note_attachments"("note_id");

ALTER TABLE "hotel_note_attachments" ADD CONSTRAINT "hotel_note_attachments_note_id_fkey"
    FOREIGN KEY ("note_id") REFERENCES "hotel_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hotel_note_comments" (
    "id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "text_de" TEXT NOT NULL,
    "text_it" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_note_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_note_comments_note_id_created_at_idx" ON "hotel_note_comments"("note_id", "created_at");
CREATE INDEX "hotel_note_comments_author_id_idx" ON "hotel_note_comments"("author_id");

ALTER TABLE "hotel_note_comments" ADD CONSTRAINT "hotel_note_comments_note_id_fkey"
    FOREIGN KEY ("note_id") REFERENCES "hotel_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotel_note_comments" ADD CONSTRAINT "hotel_note_comments_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
