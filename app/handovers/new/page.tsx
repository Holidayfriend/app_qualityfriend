import { redirect } from "next/navigation";
import { handoversEditor } from "../../../lib/handovers/access";
import { HandoversFormPage } from "../../../components/handovers/handovers-ui";

export default async function Page() {
  if (!await handoversEditor()) redirect("/access-denied");
  return <HandoversFormPage />;
}
