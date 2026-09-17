ALTER TABLE "recruiting_applications" ADD COLUMN "ai_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_error" TEXT;
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_score" INTEGER;
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_recommendation" VARCHAR(40);
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_social" INTEGER;
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_professional" INTEGER;
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_methodical" INTEGER;
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_personal" INTEGER;
ALTER TABLE "recruiting_applications" ADD COLUMN "ai_scored_at" TIMESTAMPTZ(3);
