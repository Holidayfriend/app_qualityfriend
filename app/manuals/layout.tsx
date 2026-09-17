import type { ReactNode } from "react";
import type { Metadata } from "next";
import { currentAccessUser } from "../../lib/auth/module-access";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Handbücher & Dokumente" };

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await currentAccessUser();
  if (!user) redirect("/login");
  return children;
}
