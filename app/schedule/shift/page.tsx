import { Suspense } from "react";
import { requireScheduleEditor } from "../../../lib/schedule/access";
import { ShiftPageClient } from "./shift-client";

export default async function Page() {
  await requireScheduleEditor();
  return <Suspense><ShiftPageClient /></Suspense>;
}
