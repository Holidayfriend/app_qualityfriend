import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createSession } from "../../../lib/auth/session";
import { recordAuditLog } from "../../../lib/audit/audit-service";
import { registrationRateLimit } from "../../../lib/security/registration-rate-limit";

const languages = new Set(["EN", "DE", "IT"]);

function requiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  const normalized = requiredString(value);
  return normalized || null;
}

export async function POST(request: Request) {
  const limited = await registrationRateLimit(request);
  if (limited) return limited;

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
  try {
    const userId=await prisma.$transaction(async tx=>{const hotel=await tx.hotelTenant.create({data:{hotelNameEn:hotelName,hotelNameDe:hotelName,hotelNameIt:hotelName,email,hotelLanguage:hotelLanguage as "EN"|"DE"|"IT",companyName,streetAddress,postalCode,city,country,contactPerson,phoneNumber,vatId}});const user=await tx.user.create({data:{hotelTenantId:hotel.id,firstName,lastName,email,passwordHash,phoneNumber,language:hotelLanguage as "EN"|"DE"|"IT",role:"ADMIN"}});await recordAuditLog(tx,{hotelTenantId:hotel.id,actorId:user.id,action:"CREATE",entityType:"HOTEL",entityId:hotel.id,changes:{after:{hotelName,companyName}}});await recordAuditLog(tx,{hotelTenantId:hotel.id,actorId:user.id,action:"CREATE",entityType:"USER",entityId:user.id,changes:{after:{firstName,lastName,email,role:"ADMIN"}}});return user.id});
    await createSession(userId);
    return NextResponse.json({ success: true, redirectTo: "/billing/subscribe" }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
    }
    console.error("Registration failed", error);
    return NextResponse.json({ error: "REGISTRATION_FAILED" }, { status: 500 });
  }
}
