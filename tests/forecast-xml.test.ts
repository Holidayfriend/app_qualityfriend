import assert from "node:assert/strict";
import test from "node:test";
import { parseForecastXml } from "../lib/forecast/xml-parser";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<reservations>
  <reservation id="1" date="2025-01-01" number="1/2025" type="reservation" touristParty="1" advertisingMedium="FACE" bookingChannel="WEB">
    <guest gender="female" dateOfBirth="1980-09-27" postalCode="84130" city="Dingolfing" country="DE"/>
    <roomReservations>
      <roomReservation arrival="2025-12-28" departure="2026-01-02" status="reserved" roomType="ROARE" roomNumber="48" adults="2" children="2" ratePlanCode="AKTIV">
        <sales accommodation="3090" additionalServices="35" spa="10" extras="4"/>
        <roomGuests><roomGuest gender="female" dateOfBirth="1980-09-27" country="DE"/></roomGuests>
      </roomReservation>
      <roomReservation arrival="2025-12-28" departure="2026-01-02" status="occupied" roomType="MERL" roomNumber="44" adults="2"/>
    </roomReservations>
  </reservation>
  <reservation id="2" date="2025-02-01" number="2/2025" type="cancelled">
    <roomReservations>
      <roomReservation arrival="2025-03-01" departure="2025-03-03" status="cancelled" roomType="JOHAN" roomNumber="62" adults="1"/>
    </roomReservations>
  </reservation>
  <reservation id="3" date="2025-03-01" number="3/2025" type="request">
    <roomReservations>
      <roomReservation status="request" roomType="MITT" roomNumber="46"/>
    </roomReservations>
  </reservation>
</reservations>`;

test("forecast xml keeps every reservation type and the room sales", () => {
  const parsed = parseForecastXml(xml);
  assert.equal(parsed.read, 3);
  assert.equal(parsed.skippedRooms, 1);
  assert.equal(parsed.reservations.length, 3);
  assert.deepEqual(parsed.reservations.map((row) => row.type), ["reservation", "cancelled", "request"]);
  const room = parsed.reservations[0].rooms[0];
  assert.equal(room.accommodationSale, 3090);
  assert.equal(room.additionalServicesSale, 35);
  assert.equal(room.spaSale, 10);
  assert.equal(room.extrasSale, 4);
  assert.equal(parsed.reservations[0].guestCity, "Dingolfing");
  assert.equal(parsed.reservations[0].rooms[1].accommodationSale, 0);
  assert.equal(parsed.reservations[1].rooms[0].status, "cancelled");
});

test("forecast xml rejects a file that is not a reservation export", () => {
  assert.throws(() => parseForecastXml("<Zimmerreservierungen></Zimmerreservierungen>"), /Unexpected XML root/);
});
