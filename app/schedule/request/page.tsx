"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScheduleRequestPage } from "../../../components/schedule/schedule-ui";

function RequestPage() {
  const params = useSearchParams();
  const employee = params.get("employee") || undefined;
  const requestType = params.get("type") || undefined;
  return <ScheduleRequestPage employee={employee} requestType={requestType} />;
}

export default function Page() {
  return <Suspense><RequestPage /></Suspense>;
}
