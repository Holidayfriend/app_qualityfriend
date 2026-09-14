CREATE TYPE "HousekeepingCleaningType" AS ENUM ('REGULAR', 'EXPRESS', 'DEPARTURE');
CREATE TYPE "HousekeepingAssignmentOrigin" AS ENUM ('TODAY_ONLY', 'PERMANENT');

ALTER TABLE "housekeeping_room_assignments"
  ALTER COLUMN "assigned_to_id" DROP NOT NULL,
  ADD COLUMN "reservation_stay_id" UUID,
  ADD COLUMN "cleaning_type" "HousekeepingCleaningType" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN "assignment_origin" "HousekeepingAssignmentOrigin" NOT NULL DEFAULT 'TODAY_ONLY';

ALTER TABLE "housekeeping_extra_job_assignments"
  ADD COLUMN "assignment_origin" "HousekeepingAssignmentOrigin" NOT NULL DEFAULT 'TODAY_ONLY',
  ADD COLUMN "description_snapshot" TEXT NOT NULL DEFAULT '';

CREATE TABLE "housekeeping_permanent_room_assignments" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "assigned_to_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "housekeeping_permanent_room_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "housekeeping_permanent_room_assignments_hotel_tenant_id_room_id_key" ON "housekeeping_permanent_room_assignments"("hotel_tenant_id","room_id");
CREATE INDEX "housekeeping_permanent_room_assignments_hotel_tenant_id_assigned_to_id_idx" ON "housekeeping_permanent_room_assignments"("hotel_tenant_id","assigned_to_id");

CREATE TABLE "housekeeping_permanent_extra_job_assignments" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "extra_job_id" UUID NOT NULL,
  "assigned_to_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "housekeeping_permanent_extra_job_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "housekeeping_permanent_extra_job_assignments_hotel_tenant_id_extra_job_id_assigned_to_id_key" ON "housekeeping_permanent_extra_job_assignments"("hotel_tenant_id","extra_job_id","assigned_to_id");
CREATE INDEX "housekeeping_permanent_extra_job_assignments_hotel_tenant_id_assigned_to_id_idx" ON "housekeeping_permanent_extra_job_assignments"("hotel_tenant_id","assigned_to_id");

CREATE TABLE "housekeeping_daily_runs" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "work_date" DATE NOT NULL,
  "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
  "rooms_generated" INTEGER NOT NULL DEFAULT 0,
  "extras_generated" INTEGER NOT NULL DEFAULT 0,
  "error_summary" TEXT,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(3),
  CONSTRAINT "housekeeping_daily_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "housekeeping_daily_runs_hotel_tenant_id_work_date_key" ON "housekeeping_daily_runs"("hotel_tenant_id","work_date");

ALTER TABLE "housekeeping_room_assignments" ADD CONSTRAINT "housekeeping_room_assignments_hotel_tenant_id_reservation_stay_id_fkey" FOREIGN KEY ("hotel_tenant_id","reservation_stay_id") REFERENCES "reservation_room_stays"("hotel_tenant_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_permanent_room_assignments" ADD CONSTRAINT "hk_perm_room_tenant_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_permanent_room_assignments" ADD CONSTRAINT "hk_perm_room_room_fkey" FOREIGN KEY ("hotel_tenant_id","room_id") REFERENCES "rooms"("hotel_tenant_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_permanent_room_assignments" ADD CONSTRAINT "hk_perm_room_user_fkey" FOREIGN KEY ("hotel_tenant_id","assigned_to_id") REFERENCES "users"("hotel_tenant_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_permanent_extra_job_assignments" ADD CONSTRAINT "hk_perm_extra_tenant_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_permanent_extra_job_assignments" ADD CONSTRAINT "hk_perm_extra_job_fkey" FOREIGN KEY ("hotel_tenant_id","extra_job_id") REFERENCES "extra_jobs"("hotel_tenant_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_permanent_extra_job_assignments" ADD CONSTRAINT "hk_perm_extra_user_fkey" FOREIGN KEY ("hotel_tenant_id","assigned_to_id") REFERENCES "users"("hotel_tenant_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_daily_runs" ADD CONSTRAINT "housekeeping_daily_runs_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
