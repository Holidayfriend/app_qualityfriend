import { McpPromptLibrary } from "../../../../components/settings/mcp-prompt-library";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string | string[] }> }) {
  const params = await searchParams;
  const edit = typeof params.edit === "string" && params.edit.length <= 160 ? params.edit : "";
  return <McpPromptLibrary initialEditId={edit} />;
}
