import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "../../lib/auth/session";

export default async function NotificationsLayout({ children }: { children: ReactNode }) {
  if (!await getSessionUserId()) redirect("/login");
  return children;
}
