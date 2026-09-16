import type { ReactNode } from "react";
import { requireModuleAccess } from "../../lib/auth/module-access";
import { ScheduleProvider } from "../../components/schedule/schedule-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireModuleAccess("schedule");
  return <ScheduleProvider>{children}</ScheduleProvider>;
}
