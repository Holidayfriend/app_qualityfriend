"use client";

import { Suspense } from "react";
import { ChecklistFormPage } from "../../../../components/tasks/tasks-ui";
import { BrandLoader } from "../../../../components/ui/brand-loader";

export default function Page() {
  return <Suspense fallback={<BrandLoader />}><ChecklistFormPage /></Suspense>;
}
