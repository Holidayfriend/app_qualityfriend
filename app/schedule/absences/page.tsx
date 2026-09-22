import { requireScheduleView } from "../../../lib/schedule/access";
import { ScheduleAbsencesPage } from "../../../components/schedule/schedule-ui";

export default async function Page() {
  await requireScheduleView();
  return <ScheduleAbsencesPage />;
}
