import { requireScheduleEditor } from "../../../lib/schedule/access";
import { ScheduleTemplatesPage } from "../../../components/schedule/schedule-ui";

export default async function Page() {
  await requireScheduleEditor();
  return <ScheduleTemplatesPage />;
}
