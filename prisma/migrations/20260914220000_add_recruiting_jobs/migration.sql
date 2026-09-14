CREATE TYPE "RecruitingJobFormat" AS ENUM ('CLASSIC', 'QUIZ');
CREATE TYPE "RecruitingJobStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "RecruitingApplicationStage" AS ENUM ('NEW', 'INVITED', 'OFFER', 'HIRED', 'REJECTED', 'ARCHIVED');

CREATE TABLE "recruiting_jobs" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "format" "RecruitingJobFormat" NOT NULL,
    "status" "RecruitingJobStatus" NOT NULL DEFAULT 'DRAFT',
    "department" VARCHAR(40) NOT NULL,
    "work_type" VARCHAR(40) NOT NULL,
    "start_from" VARCHAR(120) NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "auto_message" TEXT NOT NULL DEFAULT '',
    "location" VARCHAR(180) NOT NULL DEFAULT '',
    "cv_required" BOOLEAN NOT NULL DEFAULT false,
    "languages" JSONB NOT NULL,
    "listing_image" VARCHAR(255) NOT NULL DEFAULT '',
    "logo_image" VARCHAR(255) NOT NULL DEFAULT '',
    "quiz" JSONB,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiting_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruiting_jobs_slug_key" ON "recruiting_jobs"("slug");
CREATE UNIQUE INDEX "recruiting_jobs_hotel_tenant_id_id_key" ON "recruiting_jobs"("hotel_tenant_id", "id");
CREATE INDEX "recruiting_jobs_hotel_tenant_id_status_idx" ON "recruiting_jobs"("hotel_tenant_id", "status");
CREATE INDEX "recruiting_jobs_hotel_tenant_id_format_idx" ON "recruiting_jobs"("hotel_tenant_id", "format");

ALTER TABLE "recruiting_jobs" ADD CONSTRAINT "recruiting_jobs_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "recruiting_applications" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "stage" "RecruitingApplicationStage" NOT NULL DEFAULT 'NEW',
    "locale" VARCHAR(8) NOT NULL,
    "salutation" VARCHAR(20) NOT NULL DEFAULT '',
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL DEFAULT '',
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "cv_file_name" VARCHAR(255) NOT NULL DEFAULT '',
    "keep_for_other_jobs" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruiting_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruiting_applications_hotel_tenant_id_id_key" ON "recruiting_applications"("hotel_tenant_id", "id");
CREATE INDEX "recruiting_applications_hotel_tenant_id_job_id_idx" ON "recruiting_applications"("hotel_tenant_id", "job_id");
CREATE INDEX "recruiting_applications_hotel_tenant_id_created_at_idx" ON "recruiting_applications"("hotel_tenant_id", "created_at");

ALTER TABLE "recruiting_applications" ADD CONSTRAINT "recruiting_applications_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recruiting_applications" ADD CONSTRAINT "recruiting_applications_hotel_tenant_id_job_id_fkey"
    FOREIGN KEY ("hotel_tenant_id", "job_id") REFERENCES "recruiting_jobs"("hotel_tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
