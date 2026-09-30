ALTER TABLE "room_operational_states" ADD COLUMN "guest_cleaning_preference" TEXT NOT NULL DEFAULT 'DAILY';
ALTER TABLE "room_operational_states" ADD CONSTRAINT "room_guest_cleaning_preference_check" CHECK ("guest_cleaning_preference" IN ('DAILY', 'AS_NEEDED', 'NONE'));
