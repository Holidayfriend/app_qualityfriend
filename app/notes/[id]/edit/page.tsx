"use client";

import { useParams } from "next/navigation";
import { NotesFormPage } from "../../../../components/notes/notes-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <NotesFormPage id={params.id} />;
}
