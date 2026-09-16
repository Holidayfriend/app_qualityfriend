import type { ReactNode } from "react";
import { currentAccessUser } from "../../lib/auth/module-access";
import { redirect } from "next/navigation";
import { NotesProvider } from "../../components/notes/notes-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await currentAccessUser();
  if (!user) redirect("/login");
  return <NotesProvider>{children}</NotesProvider>;
}
