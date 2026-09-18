import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentAccessUser } from "../../lib/auth/module-access";
import { RepairsProvider } from "../../components/repairs/repairs-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await currentAccessUser();
  if (!user) redirect("/login");
  return <RepairsProvider>{children}</RepairsProvider>;
}
