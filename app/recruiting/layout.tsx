import type { ReactNode } from "react";
import { requireModuleAccess } from "../../lib/auth/module-access";
import { RecruitingProvider } from "../../components/recruiting/recruiting-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireModuleAccess("recruiting");
  return <RecruitingProvider>{children}</RecruitingProvider>;
}
