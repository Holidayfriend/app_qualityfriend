"use client";

import { useParams } from "next/navigation";
import { RepairsFormPage } from "../../../../components/repairs/repairs-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <RepairsFormPage id={params.id} />;
}
