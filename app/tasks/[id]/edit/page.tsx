"use client";

import { useParams } from "next/navigation";
import { TaskFormPage } from "../../../../components/tasks/tasks-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <TaskFormPage id={params.id} />;
}
