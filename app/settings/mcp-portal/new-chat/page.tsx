import { McpNewChat } from "../../../../components/settings/mcp-chat";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ promptId?: string | string[] }>;
}) {
  const query = await searchParams;
  const promptId = Array.isArray(query.promptId) ? query.promptId[0] : query.promptId;

  return <McpNewChat promptId={promptId} />;
}
