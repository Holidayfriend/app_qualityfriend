import { requireScheduleEditor } from "../../lib/schedule/access";
import { SchedulePlanPage } from "../../components/schedule/schedule-ui";

export default async function Page() {
  await requireScheduleEditor();
  return <SchedulePlanPage />;
}
