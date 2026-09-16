"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScheduleShiftPage } from "../../../components/schedule/schedule-ui";

function ShiftPage() {
  const params = useSearchParams();
  const employee = params.get("employee") || "maria";
  const day = Math.max(0, Math.min(6, Number(params.get("day") || 0)));
  return <ScheduleShiftPage employee={employee} day={day} />;
}

export default function Page() {
  return <Suspense><ShiftPage /></Suspense>;
}
