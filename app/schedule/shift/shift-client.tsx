"use client";

import { useSearchParams } from "next/navigation";
import { ScheduleShiftPage } from "../../../components/schedule/schedule-ui";

export function ShiftPageClient() {
  const params = useSearchParams();
  const employee = params.get("employee") || "";
  const day = Math.max(0, Math.min(6, Number(params.get("day") || 0)));
  return <ScheduleShiftPage employee={employee} day={day} />;
}
