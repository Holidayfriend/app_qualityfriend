import { redirect } from "next/navigation";
import { handoversEditor } from "../../../lib/handovers/access";
import { HandoversFormPage } from "../../../components/handovers/handovers-ui";

export default async function Page({ searchParams }: { searchParams: Promise<{ ai?: string }> }) {
  if (!await handoversEditor()) redirect("/access-denied");
  const params = await searchParams;
  return <HandoversFormPage aiDraft={params.ai === "1"} />;
}
