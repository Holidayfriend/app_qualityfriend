"use client";

import { useParams } from "next/navigation";
import { ManualsViewPage } from "../../../components/manuals/manuals-ui";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ManualsViewPage id={params.id} />;
}
