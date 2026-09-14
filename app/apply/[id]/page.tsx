"use client";

import { use } from "react";
import { ApplyJobScreen } from "../../../components/recruiting/apply-job-screen";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ApplyJobScreen slug={id} />;
}
