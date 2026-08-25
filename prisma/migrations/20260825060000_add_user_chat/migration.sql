CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'DOCUMENT', 'IMAGE', 'VIDEO', 'VOICE');

CREATE TABLE "chat_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_tenant_id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
  "text" TEXT,
  "attachment_path" VARCHAR(2048),
  "attachment_name" VARCHAR(255),
  "attachment_mime" VARCHAR(160),
  "attachment_size" INTEGER,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "chat_messages_hotel_tenant_id_sender_id_recipient_id_created_at_idx" ON "chat_messages"("hotel_tenant_id", "sender_id", "recipient_id", "created_at");
CREATE INDEX "chat_messages_recipient_id_read_at_created_at_idx" ON "chat_messages"("recipient_id", "read_at", "created_at");
