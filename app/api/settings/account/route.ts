import { NextResponse } from "next/server";
import { getDatabasePool, queryDatabase } from "../../../../database";
import { getSessionUserId } from "../../../../lib/auth/session";
import { recordAuditLog } from "../../../../lib/audit/audit-service";

type Actor = { id: string; hotel_tenant_id: string; role: string };

async function getActor() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const result = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id, role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1`, [userId]);
  return result.rows[0] ?? null;
}

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const user = await queryDatabase(`SELECT first_name, last_name, email, phone_number, language, role FROM users WHERE id = $1 LIMIT 1`, [actor.id]);
  const hotel = actor.role === "ADMIN" ? await queryDatabase(`SELECT hotel_name_en, hotel_name_de, hotel_name_it, email, logo_url, hotel_language, company_name, street_address, postal_code, city, country, contact_person, phone_number, vat_id, tripadvisor_id FROM hotel_tenants WHERE id = $1 AND is_active = true LIMIT 1`, [actor.hotel_tenant_id]) : null;
  return NextResponse.json({ user: user.rows[0], hotel: hotel?.rows[0] ?? null });
}

export async function PATCH(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const section = body?.section;
  const value = (key: string) => typeof body?.[key] === "string" ? (body[key] as string).trim() : "";
  const optional = (key: string) => value(key) || null;
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    if (section === "user") {
      const firstName = value("firstName"), lastName = value("lastName"), email = value("email").toLowerCase(), phoneNumber = optional("phoneNumber");
      const language = value("language").toUpperCase();
      if (!firstName || !lastName || !email || !new Set(["EN", "DE", "IT"]).has(language)) { await client.query("ROLLBACK"); return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 }); }
      const duplicate = await client.query(`SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2 AND is_deleted = false LIMIT 1`, [email, actor.id]);
      if (duplicate.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 }); }
      const previous = await client.query(`SELECT first_name, last_name, email, phone_number, language FROM users WHERE id = $1 FOR UPDATE`, [actor.id]);
      await client.query(`UPDATE users SET first_name=$1,last_name=$2,email=$3,phone_number=$4,language=$5::"HotelLanguage",updated_at=NOW() WHERE id=$6`, [firstName, lastName, email, phoneNumber, language, actor.id]);
      await recordAuditLog(client, { hotelTenantId: actor.hotel_tenant_id, actorId: actor.id, action: "UPDATE", entityType: "USER", entityId: actor.id, changes: { before: previous.rows[0], after: { firstName, lastName, email, phoneNumber, language } } });
    } else if (section === "hotel" && actor.role === "ADMIN") {
      const required = ["hotelNameEn","hotelNameDe","hotelNameIt","email","companyName","streetAddress","postalCode","city","country","contactPerson"];
      if (required.some((key) => !value(key))) { await client.query("ROLLBACK"); return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 }); }
      const previous = await client.query(`SELECT hotel_name_en, hotel_name_de, hotel_name_it, company_name FROM hotel_tenants WHERE id=$1 FOR UPDATE`, [actor.hotel_tenant_id]);
      await client.query(`UPDATE hotel_tenants SET hotel_name_en=$1,hotel_name_de=$2,hotel_name_it=$3,email=$4,logo_url=$5,company_name=$6,street_address=$7,postal_code=$8,city=$9,country=$10,contact_person=$11,phone_number=$12,vat_id=$13,tripadvisor_id=$14,updated_at=NOW() WHERE id=$15`, [value("hotelNameEn"),value("hotelNameDe"),value("hotelNameIt"),value("email").toLowerCase(),optional("logoUrl"),value("companyName"),value("streetAddress"),value("postalCode"),value("city"),value("country"),value("contactPerson"),optional("phoneNumber"),optional("vatId"),optional("tripadvisorId"),actor.hotel_tenant_id]);
      await recordAuditLog(client, { hotelTenantId: actor.hotel_tenant_id, actorId: actor.id, action: "UPDATE", entityType: "HOTEL", entityId: actor.hotel_tenant_id, changes: { before: previous.rows[0], after: { en: value("hotelNameEn"), de: value("hotelNameDe"), it: value("hotelNameIt") } } });
    } else { await client.query("ROLLBACK"); return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); }
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
