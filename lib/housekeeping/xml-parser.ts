import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";

type Node = Record<string, unknown>;
const list = (value: unknown): Node[] => value === undefined ? [] : (Array.isArray(value) ? value : [value]) as Node[];
const attr = (node: Node, key: string) => String(node[`@_${key}`] ?? "").trim();
function date(value: string, optional = false): string | null {
  if (!value && optional) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Invalid XML date");
  return value;
}
function count(value: string) {
  if (!value) return null;
  if (!/^\d+$/.test(value) || Number(value) > 100000) throw new Error("Invalid XML count");
  return Number(value);
}
function bounded(value: string, limit: number, required = false) {
  if (value.length > limit || (required && !value)) throw new Error("Invalid XML field length");
  return value;
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function parseAsaXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML document types and custom entities are not supported");
  if (XMLValidator.validate(xml) !== true) throw new Error("Malformed XML");
  const parsed = new XMLParser({ ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false, trimValues: true }).parse(xml);
  if (!Object.prototype.hasOwnProperty.call(parsed, "Zimmerreservierungen")) throw new Error("Unexpected XML root");
  const input = list(parsed.Zimmerreservierungen?.Zimmerreservierung);
  if (input.length > 10000) throw new Error("Too many XML reservations");
  const records = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const node of input) {
    const sourceStatus = attr(node, "Status");
    const statuses: Record<string, string> = { occupied: "OCCUPIED", reserved: "RESERVED", departed: "DEPARTED", roomFixed: "RESERVED", cancelled: "CANCELLED" };
    if (!statuses[sourceStatus]) { skipped++; continue; }
    const room = bounded(attr(node, "Nummer"), 40, true);
    const category = bounded(attr(node, "Name"), 180, true);
    const arrival = date(attr(node, "Anreise"))!;
    const departure = date(attr(node, "Abreise"))!;
    if (departure < arrival) throw new Error("XML departure precedes arrival");
    // This export contains no stable reservation ID. Dates changing create a new historical record.
    const key = hash([room, arrival, departure]);
    if (seen.has(key)) throw new Error("Ambiguous duplicate reservation in XML");
    seen.add(key);
    const zsb = count(attr(node, "ZSB")), erw = count(attr(node, "Erw."));
    const guestSeen = new Map<string, number>();
    const guests = list(node.Zimmergast).filter(guest => attr(guest, "NameF")).map(guest => {
      const name = bounded(attr(guest, "NameF"), 255, true);
      const dob = date(attr(guest, "GastGeburtsdatum"), true);
      const identity = hash([name, dob]);
      const occurrence = guestSeen.get(identity) ?? 0;
      guestSeen.set(identity, occurrence + 1);
      const vip = attr(guest, "VIP").toLowerCase();
      return { key: `${identity}:${occurrence}`, name, dob, language: bounded(attr(guest, "Language"), 40) || null,
        vip: ["true", "1", "yes", "ja"].includes(vip) ? true : ["false", "0", "no", "nein"].includes(vip) ? false : null,
        previousStays: count(attr(guest, "Stays")) };
    });
    const note = node.CombiBemerkungZimmerservice;
    const remarks = typeof note === "object" && note ? String((note as Node)["#text"] ?? "") : String(note ?? "");
    records.push({ key, room, category, arrival, departure, sourceStatus, status: statuses[sourceStatus],
      adults: count(attr(node, "AnzahlErwachsene")) ?? (zsb !== null || erw !== null ? (zsb ?? 0) + (erw ?? 0) : null),
      children: count(attr(node, "AnzahlKinder")), k1: count(attr(node, "K1")), k2: count(attr(node, "K2")), k3: count(attr(node, "K3")),
      board: bounded(attr(node, "Verpflegung"), 120) || null, offer: bounded(attr(node, "Offer"), 10000) || null,
      bookingGroup: bounded(attr(node, "BookingGroup"), 255) || null, remarks: bounded(remarks, 50000) || null,
      from: bounded(attr(list(node.VonZimmerreservierung)[0] ?? {}, "Nummer"), 40) || null,
      to: bounded(attr(list(node.NachZimmerreservierung)[0] ?? {}, "Nummer"), 40) || null, guests });
  }
  if (input.length > 0 && records.length === 0) throw new Error("XML contains no supported reservations");
  return { records, read: input.length, skipped };
}
