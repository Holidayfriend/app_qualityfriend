import { requireScheduleEditor } from "../../../../../lib/schedule/access";
import { ScheduleTemplateFormPage } from "../../../../../components/schedule/schedule-ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireScheduleEditor();
  const { id } = await params;
  return <ScheduleTemplateFormPage id={id} />;
}
