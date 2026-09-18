import { redirect } from "next/navigation";
import { repairsEditor } from "../../../../../lib/repairs/access";
import { RepairsFormPage } from "../../../../../components/repairs/repairs-ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!await repairsEditor()) redirect("/access-denied");
  const { id } = await params;
  return <RepairsFormPage id={id} />;
}
