import { manualsEditor } from "@/lib/manuals/access";
import { redirect } from "next/navigation";
import { ManualsUploadPage } from "../../../components/manuals/manuals-ui";

export default async function Page() {
  if (!await manualsEditor()) redirect("/access-denied");
  return <ManualsUploadPage />;
}
