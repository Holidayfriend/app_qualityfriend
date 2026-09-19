import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentAccessUser } from "../../lib/auth/module-access";
import { TasksProvider } from "../../components/tasks/tasks-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await currentAccessUser();
  if (!user) redirect("/login");
  return <TasksProvider>{children}</TasksProvider>;
}
