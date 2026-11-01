ALTER TABLE "hotel_leave_requests" ADD COLUMN IF NOT EXISTS "decision_reason" VARCHAR(2000) NOT NULL DEFAULT '';
