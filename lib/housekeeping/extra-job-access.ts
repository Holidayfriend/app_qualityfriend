import "server-only";
import { currentAccessUser } from "../auth/module-access";
import { housekeepingAccess } from "./access";

export async function extraJobActor() {
  const user = await currentAccessUser();
  return user && (await housekeepingAccess(user)).admin ? user : null;
}
