"use client";

import { useParams } from "next/navigation";
import { RecruitingUI } from "../../../../components/recruiting/recruiting-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <RecruitingUI view="job-edit" id={params.id} />;
}
