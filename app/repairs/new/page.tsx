import { redirect } from "next/navigation";
import { repairsEditor } from "../../../lib/repairs/access";
import { RepairsFormPage } from "../../../components/repairs/repairs-ui";

export default async function Page() {
  if (!await repairsEditor()) redirect("/access-denied");
  return <RepairsFormPage />;
}
