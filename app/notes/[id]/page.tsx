"use client";

import { useParams } from "next/navigation";
import { NotesDetailPage } from "../../../components/notes/notes-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <NotesDetailPage id={params.id} />;
}
