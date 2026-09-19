"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ChecklistFormPage } from "../../../../../components/tasks/tasks-ui";
import { BrandLoader } from "../../../../../components/ui/brand-loader";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <Suspense fallback={<BrandLoader />}><ChecklistFormPage id={params.id} /></Suspense>;
}
