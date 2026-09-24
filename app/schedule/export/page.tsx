import { Suspense } from "react";
import { requireScheduleEditor } from "../../../lib/schedule/access";
import { ScheduleExportPage } from "../../../components/schedule/schedule-export";

export default async function Page() {
  await requireScheduleEditor();
  return <Suspense fallback={null}><ScheduleExportPage /></Suspense>;
}
