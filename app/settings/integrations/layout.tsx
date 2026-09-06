import type { ReactNode } from "react";
import { requireModuleAccess } from "../../../lib/auth/module-access";

export default async function IntegrationsLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("settings");
  return children;
}
