import type { ReactNode } from "react";
import { requireModuleAccess } from "../../../lib/auth/module-access";

export default async function AiKeysLayout({ children }: { children: ReactNode }) {
  await requireModuleAccess("settings");
  return children;
}
