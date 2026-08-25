-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "name_en" VARCHAR(180) NOT NULL,
    "name_de" VARCHAR(180) NOT NULL,
    "name_it" VARCHAR(180) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "hotel_tenant_id" UUID NOT NULL,
    "name_en" VARCHAR(180) NOT NULL,
    "name_de" VARCHAR(180) NOT NULL,
    "name_it" VARCHAR(180) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_hotel_tenant_id_is_deleted_idx" ON "departments"("hotel_tenant_id", "is_deleted");

-- CreateIndex
CREATE INDEX "departments_hotel_tenant_id_is_active_idx" ON "departments"("hotel_tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "departments_created_by_id_idx" ON "departments"("created_by_id");

-- CreateIndex
CREATE INDEX "departments_updated_by_id_idx" ON "departments"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_hotel_tenant_id_name_en_key" ON "departments"("hotel_tenant_id", "name_en");

-- CreateIndex
CREATE INDEX "teams_hotel_tenant_id_is_deleted_idx" ON "teams"("hotel_tenant_id", "is_deleted");

-- CreateIndex
CREATE INDEX "teams_hotel_tenant_id_is_active_idx" ON "teams"("hotel_tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "teams_created_by_id_idx" ON "teams"("created_by_id");

-- CreateIndex
CREATE INDEX "teams_updated_by_id_idx" ON "teams"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_hotel_tenant_id_name_en_key" ON "teams"("hotel_tenant_id", "name_en");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
