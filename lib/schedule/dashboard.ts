import "server-only";

import { prisma } from "../prisma";
import { ensureShiftTable } from "./shifts";

export type OnDutyPerson = {
  userId: string;
  label: string;
  kind: "work" | "off" | "vac";
  time: string;
};

function shortName(firstName: string, lastName: string) {
  const first = firstName.trim() || lastName.trim();
  const initial = lastName.trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

function clockRange(start: string, end: string) {
  const part = (value: string) => {
    const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
    if (!match) return "";
    const hours = String(Number(match[1])).padStart(2, "0");
    return match[2] === "00" ? hours : `${hours}:${match[2]}`;
  };
  const from = part(start);
  const to = part(end);
  return from && to ? `${from}–${to}` : "";
}

export async function listOnDutyToday(hotelTenantId: string, workDate: string) {
  await ensureShiftTable();
  const day = new Date(`${workDate}T00:00:00.000Z`);
  const rows = await prisma.hotelShift.findMany({
    where: {
      hotelTenantId,
      workDate: day,
      user: { isDeleted: false, isActive: true },
    },
    select: {
      userId: true,
      kind: true,
      startTime: true,
      endTime: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ startTime: "asc" }, { user: { lastName: "asc" } }],
  });
  const people: OnDutyPerson[] = rows.map((row) => {
    const kind = row.kind === "VACATION" ? "vac" as const : row.kind === "OFF" ? "off" as const : "work" as const;
    return {
      userId: row.userId,
      label: shortName(row.user.firstName, row.user.lastName),
      kind,
      time: kind === "work" ? clockRange(row.startTime, row.endTime) : "",
    };
  });
  const working = people.filter((row) => row.kind === "work");
  const away = people.filter((row) => row.kind !== "work");
  return {
    date: workDate,
    onDuty: working.length,
    absent: away.length,
    people: [...working, ...away],
  };
}
