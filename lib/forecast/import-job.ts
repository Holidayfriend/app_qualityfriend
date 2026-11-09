import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { readAsaFile } from "../housekeeping/asa-file";
import { parseForecastXml, type ForecastReservationRecord } from "./xml-parser";

const chunkSize = 400;

function day(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function requiredDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function chunks<T>(rows: T[]) {
  const groups: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) groups.push(rows.slice(index, index + chunkSize));
  return groups;
}

export async function replaceHotelForecast(prisma: PrismaClient, hotelTenantId: string, reservations: ForecastReservationRecord[]) {
  const reservationRows = [];
  const roomRows = [];
  const guestRows = [];
  for (const reservation of reservations) {
    const reservationId = randomUUID();
    reservationRows.push({
      id: reservationId,
      hotelTenantId,
      externalId: reservation.externalId,
      reservationDate: day(reservation.reservationDate),
      number: reservation.number,
      type: reservation.type,
      touristParty: reservation.touristParty,
      advertisingMedium: reservation.advertisingMedium,
      bookingChannel: reservation.bookingChannel,
      bookingGroup: reservation.bookingGroup,
      guestGender: reservation.guestGender,
      guestDateOfBirth: day(reservation.guestDateOfBirth),
      guestPostalCode: reservation.guestPostalCode,
      guestCity: reservation.guestCity,
      guestCountry: reservation.guestCountry,
    });
    for (const room of reservation.rooms) {
      const roomId = randomUUID();
      roomRows.push({
        id: roomId,
        hotelTenantId,
        forecastReservationId: reservationId,
        arrivalDate: requiredDay(room.arrival),
        departureDate: requiredDay(room.departure),
        status: room.status,
        roomType: room.roomType,
        roomNumber: room.roomNumber,
        ratePlanCode: room.ratePlanCode,
        adults: room.adults,
        children: room.children,
        infants: room.infants,
        accommodationSale: room.accommodationSale,
        additionalServicesSale: room.additionalServicesSale,
        spaSale: room.spaSale,
        extrasSale: room.extrasSale,
      });
      for (const guest of room.guests) {
        guestRows.push({
          id: randomUUID(),
          hotelTenantId,
          forecastRoomId: roomId,
          gender: guest.gender,
          dateOfBirth: day(guest.dateOfBirth),
          country: guest.country,
        });
      }
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.forecastReservation.deleteMany({ where: { hotelTenantId } });
    for (const group of chunks(reservationRows)) await tx.forecastReservation.createMany({ data: group });
    for (const group of chunks(roomRows)) await tx.forecastReservationRoom.createMany({ data: group });
    for (const group of chunks(guestRows)) await tx.forecastReservationGuest.createMany({ data: group });
  }, { timeout: 300_000 });
  return { reservations: reservationRows.length, rooms: roomRows.length, guests: guestRows.length };
}

export async function importHotelForecast(prisma: PrismaClient, hotelTenantId: string, xmlName: string, readFile = readAsaFile) {
  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: hotelTenantId, isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } },
    select: { forecastXmlName: true },
  });
  if (hotel?.forecastXmlName?.trim() !== xmlName.trim()) throw new Error("Import settings or authorization changed");
  const xml = await readFile(xmlName);
  const parsed = parseForecastXml(xml);
  const saved = await replaceHotelForecast(prisma, hotelTenantId, parsed.reservations);
  return { ...saved, read: parsed.read, skippedRooms: parsed.skippedRooms, checksum: createHash("sha256").update(xml).digest("hex") };
}
