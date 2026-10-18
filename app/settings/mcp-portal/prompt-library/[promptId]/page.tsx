import { McpPromptDetail } from "../../../../../components/settings/mcp-prompt-detail";

export default async function Page({ params }: { params: Promise<{ promptId: string }> }) {
  const { promptId } = await params;
  return <McpPromptDetail promptId={promptId} />;
}
