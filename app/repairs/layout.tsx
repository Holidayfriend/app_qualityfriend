import type { ReactNode } from "react";
import { requireModuleAccess } from "../../lib/auth/module-access";
import { RepairsProvider } from "../../components/repairs/repairs-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireModuleAccess("repairs");
  return <RepairsProvider>{children}</RepairsProvider>;
}
