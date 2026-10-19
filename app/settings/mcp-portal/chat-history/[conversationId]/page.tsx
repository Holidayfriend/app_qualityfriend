import { McpConversationChat } from "../../../../../components/settings/mcp-chat";

export default async function Page({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return <McpConversationChat conversationId={conversationId} />;
}
