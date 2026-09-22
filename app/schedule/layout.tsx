import type { ReactNode } from "react";
import { currentAccessUser } from "../../lib/auth/module-access";
import { redirect } from "next/navigation";
import { ScheduleProvider } from "../../components/schedule/schedule-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await currentAccessUser();
  if (!user) redirect("/login");
  return <ScheduleProvider>{children}</ScheduleProvider>;
}
