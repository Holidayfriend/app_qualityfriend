-- A cleaner may be responsible for a room even when no stay cleaning is due.
ALTER TYPE "HousekeepingCleaningType" ADD VALUE IF NOT EXISTS 'NONE';
