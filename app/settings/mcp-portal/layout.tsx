import type { ReactNode } from "react";
import { McpPortalShell } from "../../../components/settings/mcp-portal-shell";
import { requireModuleAccess } from "../../../lib/auth/module-access";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireModuleAccess("mcp");
  return <McpPortalShell>{children}</McpPortalShell>;
}
