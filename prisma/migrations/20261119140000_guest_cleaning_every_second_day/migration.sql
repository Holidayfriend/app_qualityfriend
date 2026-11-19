ALTER TABLE "room_operational_states" DROP CONSTRAINT "room_guest_cleaning_preference_check";
ALTER TABLE "room_operational_states" ADD CONSTRAINT "room_guest_cleaning_preference_check" CHECK ("guest_cleaning_preference" IN ('DAILY', 'EVERY_SECOND_DAY', 'AS_NEEDED', 'NONE'));
