import { redirect } from "next/navigation";
import { notesEditor } from "../../../../../lib/notes/access";
import { NotesFormPage } from "../../../../../components/notes/notes-ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!await notesEditor()) redirect("/access-denied");
  const { id } = await params;
  return <NotesFormPage id={id} />;
}
