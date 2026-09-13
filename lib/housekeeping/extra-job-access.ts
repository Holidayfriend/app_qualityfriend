import "server-only";
import { accessibleModules, currentAccessUser } from "../auth/module-access";

export async function extraJobActor() {
  const user = await currentAccessUser();
  return user && (await accessibleModules(user)).includes("housekeeping") ? user : null;
}
