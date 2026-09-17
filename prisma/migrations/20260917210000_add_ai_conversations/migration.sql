CREATE TABLE "ai_conversations" (
  "id" UUID NOT NULL,
  "hotel_tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assistant_key" VARCHAR(40) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_conversations_hotel_tenant_id_fkey" FOREIGN KEY ("hotel_tenant_id") REFERENCES "hotel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_conversations_hotel_tenant_id_user_id_assistant_key_key" ON "ai_conversations"("hotel_tenant_id", "user_id", "assistant_key");
CREATE INDEX "ai_conversations_hotel_tenant_id_user_id_idx" ON "ai_conversations"("hotel_tenant_id", "user_id");

CREATE TABLE "ai_conversation_messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ai_conversation_messages_conversation_id_created_at_idx" ON "ai_conversation_messages"("conversation_id", "created_at");
