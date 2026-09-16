"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScheduleRequestPage } from "../../../components/schedule/schedule-ui";

function RequestPage() {
  const employee = useSearchParams().get("employee") || undefined;
  return <ScheduleRequestPage employee={employee} />;
}

export default function Page() {
  return <Suspense><RequestPage /></Suspense>;
}
