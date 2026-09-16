import "server-only";

import { accessibleModules, currentAccessUser } from "../auth/module-access";

export async function notesActor() {
  const user = await currentAccessUser();
  return user && (await accessibleModules(user)).includes("notes") ? user : null;
}
