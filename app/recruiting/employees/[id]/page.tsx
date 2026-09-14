"use client";

import { useParams } from "next/navigation";
import { RecruitingUI } from "../../../../components/recruiting/recruiting-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <RecruitingUI view="employee-detail" id={params.id} />;
}
