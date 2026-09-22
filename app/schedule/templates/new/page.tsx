import { requireScheduleEditor } from "../../../../lib/schedule/access";
import { ScheduleTemplateFormPage } from "../../../../components/schedule/schedule-ui";

export default async function Page() {
  await requireScheduleEditor();
  return <ScheduleTemplateFormPage />;
}
