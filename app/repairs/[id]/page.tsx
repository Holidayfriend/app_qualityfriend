"use client";

import { useParams } from "next/navigation";
import { RepairsDetailPage } from "../../../components/repairs/repairs-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <RepairsDetailPage id={params.id} />;
}
