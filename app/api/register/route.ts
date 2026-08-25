import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getDatabasePool } from "../../../database";
import { createSession } from "../../../lib/auth/session";
import { recordAuditLog } from "../../../lib/audit/audit-service";

const languages = new Set(["EN", "DE", "IT"]);

function requiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  const normalized = requiredString(value);
  return normalized || null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const data = body as Record<string, unknown>;
  const firstName = requiredString(data.firstName);
  const lastName = requiredString(data.lastName);
  const companyName = requiredString(data.company);
  const hotelName = requiredString(data.hotelName);
  const email = requiredString(data.email).toLowerCase();
  const password = requiredString(data.password);
  const contactPerson = requiredString(data.contactPerson);
  const country = requiredString(data.country);
  const city = requiredString(data.city);
  const streetAddress = requiredString(data.streetAddress);
  const postalCode = requiredString(data.zip);
  const requestedLanguage = requiredString(data.hotelLanguage).toUpperCase();
  const hotelLanguage = languages.has(requestedLanguage) ? requestedLanguage : "EN";

  if (!firstName || !lastName || !companyName || !hotelName || !email || !contactPerson || !country || !city || !streetAddress || !postalCode || password.length < 8) {
    return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  }

  const phoneNumber = optionalString(data.phone);
  const vatId = optionalString(data.vatId);
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");
    const hotel = await client.query<{ id: string }>(
      `INSERT INTO hotel_tenants
        (id, hotel_name_en, hotel_name_de, hotel_name_it, email, hotel_language, company_name,
         street_address, postal_code, city, country, contact_person, phone_number, vat_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $1, $1, $2, $3::"HotelLanguage", $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING id`,
      [hotelName, email, hotelLanguage, companyName, streetAddress, postalCode, city, country, contactPerson, phoneNumber, vatId],
    );

    const user = await client.query<{ id: string }>(
      `INSERT INTO users
        (id, hotel_tenant_id, first_name, last_name, email, password_hash, phone_number, language, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::"HotelLanguage", 'ADMIN', NOW(), NOW())
       RETURNING id`,
      [hotel.rows[0].id, firstName, lastName, email, passwordHash, phoneNumber, hotelLanguage],
    );
    await recordAuditLog(client, { hotelTenantId: hotel.rows[0].id, actorId: user.rows[0].id, action: "CREATE", entityType: "HOTEL", entityId: hotel.rows[0].id, changes: { after: { hotelName, companyName } } });
    await recordAuditLog(client, { hotelTenantId: hotel.rows[0].id, actorId: user.rows[0].id, action: "CREATE", entityType: "USER", entityId: user.rows[0].id, changes: { after: { firstName, lastName, email, role: "ADMIN" } } });
    await client.query("COMMIT");
    await createSession(user.rows[0].id);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
    }
    console.error("Registration failed", error);
    return NextResponse.json({ error: "REGISTRATION_FAILED" }, { status: 500 });
  } finally {
    client.release();
  }
}
