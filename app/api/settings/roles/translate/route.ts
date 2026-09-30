import { roleAdministrator, validRoleName } from "../../../../../lib/settings/hotel-roles";
import { translateEntityName } from "../../../../../lib/settings/translate";

export async function POST(request: Request) {
  const actor = await roleAdministrator();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!validRoleName(body?.name) || !["en", "de", "it"].includes(body?.locale)) {
    return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  }
  const names = await translateEntityName(actor.hotelTenantId, body.locale, body.name, "user role");
  return Response.json(names);
}
