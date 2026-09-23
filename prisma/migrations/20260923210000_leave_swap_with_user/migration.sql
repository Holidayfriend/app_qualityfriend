ALTER TABLE "hotel_leave_requests" ADD COLUMN IF NOT EXISTS "swap_with_user_id" UUID;
CREATE INDEX IF NOT EXISTS "hotel_leave_requests_swap_with_user_id_idx" ON "hotel_leave_requests"("swap_with_user_id");
