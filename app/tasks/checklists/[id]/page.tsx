"use client";

import { useParams } from "next/navigation";
import { ChecklistDetailPage } from "../../../../components/tasks/tasks-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ChecklistDetailPage id={params.id} />;
}
