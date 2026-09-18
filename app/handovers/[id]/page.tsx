"use client";

import { useParams } from "next/navigation";
import { HandoversDetailPage } from "../../../components/handovers/handovers-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <HandoversDetailPage id={params.id} />;
}
