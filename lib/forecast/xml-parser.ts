import { XMLParser, XMLValidator } from "fast-xml-parser";

type Node = Record<string, unknown>;

export type ForecastGuest = { gender: string | null; dateOfBirth: string | null; country: string | null };
export type ForecastRoom = {
  arrival: string;
  departure: string;
  status: string;
  roomType: string;
  roomNumber: string;
  ratePlanCode: string | null;
  adults: number | null;
  children: number | null;
  infants: number | null;
  accommodationSale: number;
  additionalServicesSale: number;
  spaSale: number;
  extrasSale: number;
  guests: ForecastGuest[];
};
export type ForecastReservationRecord = {
  externalId: string;
  reservationDate: string | null;
  number: string;
  type: string;
  touristParty: number;
  advertisingMedium: string | null;
  bookingChannel: string | null;
  bookingGroup: string | null;
  guestGender: string | null;
  guestDateOfBirth: string | null;
  guestPostalCode: string | null;
  guestCity: string | null;
  guestCountry: string | null;
  rooms: ForecastRoom[];
};

const list = (value: unknown): Node[] => value === undefined || value === null ? [] : (Array.isArray(value) ? value : [value]) as Node[];
const attr = (node: Node | undefined, key: string) => String(node?.[`@_${key}`] ?? "").trim();

function bounded(value: string, limit: number) {
  if (value.length > limit) throw new Error("Invalid XML field length");
  return value;
}

function optionalDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) return null;
  return value;
}

function count(value: string) {
  if (!value) return null;
  if (!/^\d+$/.test(value) || Number(value) > 100000) throw new Error("Invalid XML count");
  return Number(value);
}

function money(value: string) {
  if (!value) return 0;
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error("Invalid XML amount");
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || Math.abs(amount) > 999999999999.99) throw new Error("Invalid XML amount");
  return amount;
}

function text(value: string, limit: number) {
  const clean = bounded(value, limit);
  return clean || null;
}

export function parseForecastXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML document types and custom entities are not supported");
  if (XMLValidator.validate(xml) !== true) throw new Error("Malformed XML");
  const parsed = new XMLParser({ ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false, trimValues: true }).parse(xml) as Node;
  if (!Object.prototype.hasOwnProperty.call(parsed, "reservations")) throw new Error("Unexpected XML root");
  const input = list((parsed.reservations as Node | undefined)?.reservation);
  if (input.length > 50000) throw new Error("Too many XML reservations");
  const seen = new Set<string>();
  const reservations: ForecastReservationRecord[] = [];
  let skippedRooms = 0;
  for (const node of input) {
    const externalId = bounded(attr(node, "id"), 64);
    if (!externalId) continue;
    if (seen.has(externalId)) throw new Error("Ambiguous duplicate reservation in XML");
    seen.add(externalId);
    const guest = list(node.guest)[0];
    const rooms: ForecastRoom[] = [];
    for (const room of list((node.roomReservations as Node | undefined)?.roomReservation)) {
      const arrival = optionalDate(attr(room, "arrival"));
      const departure = optionalDate(attr(room, "departure"));
      if (!arrival || !departure || departure < arrival) {
        skippedRooms += 1;
        continue;
      }
      const sales = list(room.sales)[0];
      rooms.push({
        arrival,
        departure,
        status: text(attr(room, "status"), 40) ?? "",
        roomType: text(attr(room, "roomType"), 80) ?? "",
        roomNumber: text(attr(room, "roomNumber"), 40) ?? "",
        ratePlanCode: text(attr(room, "ratePlanCode"), 80),
        adults: count(attr(room, "adults")),
        children: count(attr(room, "children")),
        infants: count(attr(room, "infants")),
        accommodationSale: money(attr(sales, "accommodation")),
        additionalServicesSale: money(attr(sales, "additionalServices")),
        spaSale: money(attr(sales, "spa")),
        extrasSale: money(attr(sales, "extras")),
        guests: list((room.roomGuests as Node | undefined)?.roomGuest).map((person) => ({
          gender: text(attr(person, "gender"), 20),
          dateOfBirth: optionalDate(attr(person, "dateOfBirth")),
          country: text(attr(person, "country"), 80),
        })),
      });
    }
    reservations.push({
      externalId,
      reservationDate: optionalDate(attr(node, "date")),
      number: text(attr(node, "number"), 40) ?? "",
      type: text(attr(node, "type"), 40) ?? "",
      touristParty: count(attr(node, "touristParty")) ?? 0,
      advertisingMedium: text(attr(node, "advertisingMedium"), 80),
      bookingChannel: text(attr(node, "bookingChannel"), 120),
      bookingGroup: text(attr(node, "bookingGroup"), 255),
      guestGender: text(attr(guest, "gender"), 20),
      guestDateOfBirth: optionalDate(attr(guest, "dateOfBirth")),
      guestPostalCode: text(attr(guest, "postalCode"), 20),
      guestCity: text(attr(guest, "city"), 120),
      guestCountry: text(attr(guest, "country"), 80),
      rooms,
    });
  }
  if (input.length > 0 && reservations.length === 0) throw new Error("XML contains no supported reservations");
  return { reservations, read: input.length, skippedRooms };
}
