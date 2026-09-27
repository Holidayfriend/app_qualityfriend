ALTER TABLE "chat_messages" ALTER COLUMN "recipient_id" DROP NOT NULL;

ALTER TABLE "chat_messages" ADD COLUMN "team_id" UUID;
ALTER TABLE "chat_messages" ADD COLUMN "department_id" UUID;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_one_target_chk" CHECK (
  (CASE WHEN "recipient_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "team_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "department_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE INDEX "chat_messages_hotel_tenant_id_team_id_created_at_idx" ON "chat_messages"("hotel_tenant_id", "team_id", "created_at");
CREATE INDEX "chat_messages_hotel_tenant_id_department_id_created_at_idx" ON "chat_messages"("hotel_tenant_id", "department_id", "created_at");

CREATE TABLE "team_chat_reads" (
  "user_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "last_read_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "team_chat_reads_pkey" PRIMARY KEY ("user_id", "team_id"),
  CONSTRAINT "team_chat_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "team_chat_reads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "team_chat_reads_team_id_idx" ON "team_chat_reads"("team_id");

CREATE TABLE "department_chat_reads" (
  "user_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "last_read_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "department_chat_reads_pkey" PRIMARY KEY ("user_id", "department_id"),
  CONSTRAINT "department_chat_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "department_chat_reads_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "department_chat_reads_department_id_idx" ON "department_chat_reads"("department_id");
