import "server-only";

import { accessibleModules, currentAccessUser } from "../auth/module-access";

export async function recruitingActor() {
  const user = await currentAccessUser();
  return user && (await accessibleModules(user)).includes("recruiting") ? user : null;
}
