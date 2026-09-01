import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentAccessUser } from "../../../lib/auth/module-access";

export default async function Layout({ children }: { children: ReactNode }) {
  if (!await currentAccessUser()) redirect("/login");
  return children;
}
