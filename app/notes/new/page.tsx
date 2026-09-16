import { redirect } from "next/navigation";
import { notesEditor } from "../../../lib/notes/access";
import { NotesFormPage } from "../../../components/notes/notes-ui";

export default async function Page() {
  if (!await notesEditor()) redirect("/access-denied");
  return <NotesFormPage />;
}
