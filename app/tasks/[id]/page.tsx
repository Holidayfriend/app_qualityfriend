"use client";

import { useParams } from "next/navigation";
import { TaskDetailPage } from "../../../components/tasks/tasks-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <TaskDetailPage id={params.id} />;
}
