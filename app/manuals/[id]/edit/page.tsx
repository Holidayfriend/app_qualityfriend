"use client";

import { useParams } from "next/navigation";
import { ManualsEditPage } from "../../../../components/manuals/manuals-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ManualsEditPage id={params.id} />;
}
