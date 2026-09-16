import type { ReactNode } from "react";
import { requireModuleAccess } from "../../lib/auth/module-access";
import { NotesProvider } from "../../components/notes/notes-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireModuleAccess("notes");
  return <NotesProvider>{children}</NotesProvider>;
}
