import { redirect } from "next/navigation";
import { handoversEditor } from "../../../../lib/handovers/access";
import { HandoversFormPage } from "../../../../components/handovers/handovers-ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!await handoversEditor()) redirect("/access-denied");
  const { id } = await params;
  return <HandoversFormPage id={id} />;
}
