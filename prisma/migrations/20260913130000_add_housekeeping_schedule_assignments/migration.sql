CREATE TABLE "housekeeping_room_assignments" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "room_id" UUID NOT NULL,
    "assigned_to_id" UUID NOT NULL,
    "planned_minutes" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "housekeeping_room_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "housekeeping_room_assignments_planned_minutes_check" CHECK ("planned_minutes" >= 0)
);

CREATE TABLE "housekeeping_extra_job_assignments" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "extra_job_id" UUID NOT NULL,
    "assigned_to_id" UUID NOT NULL,
    "planned_minutes" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "housekeeping_extra_job_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "housekeeping_extra_job_assignments_planned_minutes_check" CHECK ("planned_minutes" >= 0)
);

CREATE UNIQUE INDEX "housekeeping_room_assignments_hotel_tenant_id_work_date_room_id_key"
    ON "housekeeping_room_assignments"("hotel_tenant_id", "work_date", "room_id");
CREATE INDEX "housekeeping_room_assignments_hotel_tenant_id_work_date_assigned_to_id_idx"
    ON "housekeeping_room_assignments"("hotel_tenant_id", "work_date", "assigned_to_id");
CREATE UNIQUE INDEX "housekeeping_extra_job_assignments_hotel_tenant_id_work_date_extra_job_id_assigned_to_id_key"
    ON "housekeeping_extra_job_assignments"("hotel_tenant_id", "work_date", "extra_job_id", "assigned_to_id");
CREATE INDEX "housekeeping_extra_job_assignments_hotel_tenant_id_work_date_assigned_to_id_idx"
    ON "housekeeping_extra_job_assignments"("hotel_tenant_id", "work_date", "assigned_to_id");

ALTER TABLE "housekeeping_room_assignments" ADD CONSTRAINT "housekeeping_room_assignments_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_room_assignments" ADD CONSTRAINT "housekeeping_room_assignments_hotel_tenant_id_room_id_fkey"
    FOREIGN KEY ("hotel_tenant_id", "room_id") REFERENCES "rooms"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_room_assignments" ADD CONSTRAINT "housekeeping_room_assignments_hotel_tenant_id_assigned_to_id_fkey"
    FOREIGN KEY ("hotel_tenant_id", "assigned_to_id") REFERENCES "users"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_extra_job_assignments" ADD CONSTRAINT "housekeeping_extra_job_assignments_hotel_tenant_id_fkey"
    FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "extra_jobs_hotel_tenant_id_id_key" ON "extra_jobs"("hotel_tenant_id", "id");
ALTER TABLE "housekeeping_extra_job_assignments" ADD CONSTRAINT "housekeeping_extra_job_assignments_hotel_tenant_id_extra_job_id_fkey"
    FOREIGN KEY ("hotel_tenant_id", "extra_job_id") REFERENCES "extra_jobs"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "housekeeping_extra_job_assignments" ADD CONSTRAINT "housekeeping_extra_job_assignments_hotel_tenant_id_assigned_to_id_fkey"
    FOREIGN KEY ("hotel_tenant_id", "assigned_to_id") REFERENCES "users"("hotel_tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
