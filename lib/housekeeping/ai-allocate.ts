import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { cleaningPlan, hotelLocalDate } from "./daily-plan";
import { housekeepingAccess } from "./access";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function shiftDate(value: string, days: number) {
  const next = asDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isBirthdayOn(dateOfBirth: Date | null, day: string) {
  if (!dateOfBirth) return false;
  return dateOfBirth.getUTCMonth() + 1 === Number(day.slice(5, 7)) && dateOfBirth.getUTCDate() === Number(day.slice(8, 10));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9äöüßàèéìòù]+/gi, " ").replace(/\s+/g, " ").trim();
}

async function completeJson(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.1, response_format: { type: "json_object" }, messages }),
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });
  const data = (await response.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed.");
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty model reply.");
  return JSON.parse(content) as Record<string, unknown>;
}

export async function housekeepingUsers(prisma: PrismaClient, hotelTenantId: string) {
  const users = await prisma.user.findMany({
    where: { hotelTenantId, isActive: true, isDeleted: false },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  const access = await Promise.all(users.map(async (user) => ({
    user,
    allowed: user.role !== "ADMIN" && (await housekeepingAccess({ id: user.id, hotel_tenant_id: hotelTenantId, role: user.role })).housekeeper,
  })));
  return access.filter((entry) => entry.allowed).map((entry) => ({
    id: entry.user.id,
    name: `${entry.user.firstName} ${entry.user.lastName}`.trim(),
  }));
}

type ExtraCatalog = { id: string; descriptionEn: string; descriptionDe: string; descriptionIt: string; minutes: number };

function extraLabels(job: ExtraCatalog) {
  return [job.descriptionEn, job.descriptionDe, job.descriptionIt].map(normalize).filter(Boolean);
}

function matchExtra(catalog: ExtraCatalog[], extraId: unknown, description: unknown) {
  if (typeof extraId === "string" && uuid.test(extraId)) {
    const hit = catalog.find((job) => job.id === extraId);
    if (hit) return hit;
  }
  const needle = typeof description === "string" ? normalize(description) : "";
  if (!needle) return null;
  return catalog.find((job) => extraLabels(job).some((label) => label === needle || label.includes(needle) || (needle.length > 8 && needle.includes(label)))) ?? null;
}

function stayKind(arrival: string, departure: string, day: string) {
  if (arrival === day) return "arrival";
  if (departure === day) return "departure";
  return "stay";
}

async function collectFacts(prisma: PrismaClient, hotelTenantId: string, date: string) {
  const day = asDate(date);
  const yesterday = shiftDate(date, -1);
  const tomorrow = shiftDate(date, 1);
  const [employees, extras, weather, stays, assignments, extraAssignments, states] = await Promise.all([
    housekeepingUsers(prisma, hotelTenantId),
    prisma.extraJob.findMany({ where: { hotelTenantId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.hotelWeather.findUnique({
      where: { hotelTenantId },
      select: { cityName: true, temperatureC: true, conditionKey: true, icon: true, rainFromHour: true, windKmh: true, uvIndex: true },
    }),
    prisma.reservationRoomStay.findMany({
      where: {
        hotelTenantId,
        reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        OR: [
          { arrivalDate: { lte: day }, departureDate: { gte: day } },
          { arrivalDate: asDate(yesterday) },
          { departureDate: asDate(yesterday) },
          { arrivalDate: asDate(tomorrow) },
          { departureDate: asDate(tomorrow) },
        ],
      },
      select: {
        id: true,
        roomId: true,
        arrivalDate: true,
        departureDate: true,
        serviceRemarks: true,
        sourceFromRoomNumber: true,
        sourceToRoomNumber: true,
        adultCount: true,
        childCount: true,
        room: { select: { number: true, floor: { select: { nameEn: true, code: true } }, category: { select: { normalMinutes: true, expressMinutes: true, departureMinutes: true, cleaningFrequency: true, cleaningWeekdays: true } } } },
        reservationGuestRecords: { select: { name: true, dateOfBirth: true, vip: true } },
      },
      take: 220,
    }),
    prisma.housekeepingRoomAssignment.findMany({
      where: { hotelTenantId, workDate: day },
      select: { roomId: true, assignedToId: true, plannedMinutes: true, completedAt: true, reservationStayId: true },
    }),
    prisma.housekeepingExtraJobAssignment.findMany({
      where: { hotelTenantId, workDate: day },
      select: { extraJobId: true, assignedToId: true, plannedMinutes: true },
    }),
    prisma.roomOperationalState.findMany({
      where: { hotelTenantId },
      select: { roomId: true, cleanliness: true, breakfastInRoom: true, doNotDisturb: true, noService: true, isExpress: true },
    }),
  ]);
  const stateByRoom = new Map(states.map((row) => [row.roomId, row]));
  const assignmentByRoom = new Map(assignments.map((row) => [row.roomId, row]));
  const todayStays = stays.filter((stay) => dateOnly(stay.arrivalDate) <= date && dateOnly(stay.departureDate) >= date);
  const rooms = todayStays.map((stay) => {
    const arrival = dateOnly(stay.arrivalDate);
    const departure = dateOnly(stay.departureDate);
    const category = stay.room.category;
    const plan = cleaningPlan({
      arrival_date: arrival,
      departure_date: departure,
      normal_minutes: category?.normalMinutes ?? null,
      express_minutes: category?.expressMinutes ?? null,
      departure_minutes: category?.departureMinutes ?? null,
      cleaning_frequency: category?.cleaningFrequency ?? null,
      cleaning_weekdays: category?.cleaningWeekdays ?? [],
    }, date);
    const state = stateByRoom.get(stay.roomId);
    const assignment = assignmentByRoom.get(stay.roomId);
    const guests = stay.reservationGuestRecords;
    return {
      stayId: stay.id,
      roomId: stay.roomId,
      number: stay.room.number,
      floor: stay.room.floor?.nameEn || stay.room.floor?.code || "",
      kind: stayKind(arrival, departure, date),
      minutes: plan.minutes,
      cleaningType: plan.type,
      note: (stay.serviceRemarks || "").slice(0, 220) || null,
      fromRoom: stay.sourceFromRoomNumber,
      toRoom: stay.sourceToRoomNumber,
      vip: guests.some((guest) => guest.vip === true),
      birthdayToday: guests.filter((guest) => isBirthdayOn(guest.dateOfBirth, date)).map((guest) => guest.name),
      guests: guests.map((guest) => guest.name).slice(0, 4),
      dnd: state?.doNotDisturb ?? false,
      noService: state?.noService ?? false,
      breakfastInRoom: state?.breakfastInRoom ?? false,
      cleanliness: state?.cleanliness ?? "UNKNOWN",
      assignedToId: assignment?.assignedToId ?? null,
      completed: Boolean(assignment?.completedAt),
    };
  });
  const nearby = (target: string) => stays.filter((stay) => dateOnly(stay.arrivalDate) === target || dateOnly(stay.departureDate) === target).slice(0, 40).map((stay) => ({
    room: stay.room.number,
    arrival: dateOnly(stay.arrivalDate),
    departure: dateOnly(stay.departureDate),
    vip: stay.reservationGuestRecords.some((guest) => guest.vip === true),
    birthday: stay.reservationGuestRecords.some((guest) => isBirthdayOn(guest.dateOfBirth, date)),
    note: (stay.serviceRemarks || "").slice(0, 120) || null,
  }));
  const load = Object.fromEntries(employees.map((employee) => {
    const roomMinutes = assignments.filter((row) => row.assignedToId === employee.id).reduce((sum, row) => sum + row.plannedMinutes, 0);
    const extraMinutes = extraAssignments.filter((row) => row.assignedToId === employee.id).reduce((sum, row) => sum + row.plannedMinutes, 0);
    return [employee.id, roomMinutes + extraMinutes];
  }));
  return {
    date,
    yesterday,
    tomorrow,
    weather: weather ? { city: weather.cityName, temperatureC: weather.temperatureC, condition: weather.conditionKey, icon: weather.icon, rainFromHour: weather.rainFromHour, windKmh: weather.windKmh, uvIndex: weather.uvIndex } : null,
    employees: employees.map((employee) => ({ id: employee.id, name: employee.name, assignedMinutes: load[employee.id] ?? 0, capacityMinutes: 480 })),
    extraCatalog: extras.map((job) => ({ id: job.id, descriptionEn: job.descriptionEn, descriptionDe: job.descriptionDe, descriptionIt: job.descriptionIt, minutes: job.minutes })),
    extrasAlreadyAssigned: extraAssignments.map((row) => ({ extraJobId: row.extraJobId, employeeId: row.assignedToId })),
    rooms,
    yesterdayReservations: nearby(yesterday),
    tomorrowReservations: nearby(tomorrow),
  };
}

type Plan = {
  rooms: Array<{ roomId: string; employeeId: string }>;
  extras: Array<{ extraId?: string; description?: string; descriptionEn?: string; descriptionDe?: string; descriptionIt?: string; minutes?: number; employeeIds: string[]; reason?: string }>;
};

function parsePlan(raw: Record<string, unknown> | null): Plan {
  const rooms = Array.isArray(raw?.rooms) ? raw.rooms : [];
  const extras = Array.isArray(raw?.extras) ? raw.extras : [];
  return {
    rooms: rooms.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const data = row as Record<string, unknown>;
      const roomId = typeof data.roomId === "string" ? data.roomId : "";
      const employeeId = typeof data.employeeId === "string" ? data.employeeId : "";
      if (!uuid.test(roomId) || !uuid.test(employeeId)) return [];
      return [{ roomId, employeeId }];
    }),
    extras: extras.slice(0, 8).flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const data = row as Record<string, unknown>;
      const employeeIds = Array.isArray(data.employeeIds) ? data.employeeIds.filter((id): id is string => typeof id === "string" && uuid.test(id)) : [];
      const extraId = typeof data.extraId === "string" ? data.extraId : undefined;
      const description = typeof data.description === "string" ? data.description.trim().slice(0, 180) : undefined;
      if (!employeeIds.length || (!extraId && !description)) return [];
      return [{
        extraId,
        description,
        descriptionEn: typeof data.descriptionEn === "string" ? data.descriptionEn.trim().slice(0, 180) : description,
        descriptionDe: typeof data.descriptionDe === "string" ? data.descriptionDe.trim().slice(0, 180) : description,
        descriptionIt: typeof data.descriptionIt === "string" ? data.descriptionIt.trim().slice(0, 180) : description,
        minutes: typeof data.minutes === "number" ? data.minutes : undefined,
        employeeIds: employeeIds.slice(0, 3),
        reason: typeof data.reason === "string" ? data.reason.slice(0, 160) : undefined,
      }];
    }),
  };
}

function fallbackPlan(facts: Awaited<ReturnType<typeof collectFacts>>): Plan {
  const employees = [...facts.employees].sort((left, right) => left.assignedMinutes - right.assignedMinutes);
  if (!employees.length) return { rooms: [], extras: [] };
  const rooms: Plan["rooms"] = [];
  const load = employees.map((employee) => employee.assignedMinutes);
  for (const room of facts.rooms.filter((item) => !item.noService && !item.completed && !item.assignedToId)) {
    let index = 0;
    for (let i = 1; i < load.length; i++) if (load[i] < load[index]) index = i;
    rooms.push({ roomId: room.roomId, employeeId: employees[index].id });
    load[index] += room.minutes;
  }
  const extras: Plan["extras"] = [];
  const pick = (test: (label: string) => boolean) => facts.extraCatalog.find((job) => extraLabels(job).some(test));
  const least = employees[0]?.id;
  const wet = facts.weather && /rain|snow|drizzle|thunderstorm/i.test(facts.weather.condition);
  if (wet) {
    const windows = pick((label) => /fenster|window|finestre|balkon|balcon/.test(label));
    if (windows && least) extras.push({ extraId: windows.id, employeeIds: [least], reason: "Weather" });
  }
  const birthdayRooms = facts.rooms.filter((room) => room.birthdayToday.length);
  if (birthdayRooms.length) {
    const existing = pick((label) => /birthday|geburtstag|compleanno/.test(label));
    const employeeId = birthdayRooms[0].assignedToId || rooms.find((row) => row.roomId === birthdayRooms[0].roomId)?.employeeId || least;
    if (employeeId) {
      extras.push(existing
        ? { extraId: existing.id, employeeIds: [employeeId], reason: "Guest birthday" }
        : { description: `Birthday amenities room ${birthdayRooms[0].number}`, minutes: 15, employeeIds: [employeeId], reason: "Guest birthday" });
    }
  }
  const vipArrival = facts.rooms.find((room) => room.vip && room.kind === "arrival");
  if (vipArrival) {
    const existing = pick((label) => /\bvip\b/.test(label));
    const employeeId = vipArrival.assignedToId || rooms.find((row) => row.roomId === vipArrival.roomId)?.employeeId || least;
    if (employeeId) {
      extras.push(existing
        ? { extraId: existing.id, employeeIds: [employeeId], reason: "VIP arrival" }
        : { description: `VIP welcome room ${vipArrival.number}`, minutes: 15, employeeIds: [employeeId], reason: "VIP arrival" });
    }
  }
  return { rooms, extras };
}

async function assignRoomToday(prisma: PrismaClient, hotelTenantId: string, date: string, roomId: string, employeeId: string, stay: { id: string; minutes: number; cleaningType: string }) {
  await prisma.$executeRaw`INSERT INTO housekeeping_room_assignments (id,hotel_tenant_id,work_date,room_id,assigned_to_id,reservation_stay_id,cleaning_type,assignment_origin,planned_minutes,updated_at) VALUES (${randomUUID()}::uuid,${hotelTenantId}::uuid,${date}::date,${roomId}::uuid,${employeeId}::uuid,${stay.id}::uuid,${stay.cleaningType}::"HousekeepingCleaningType",'TODAY_ONLY'::"HousekeepingAssignmentOrigin",${stay.minutes},NOW()) ON CONFLICT (hotel_tenant_id,work_date,room_id) DO UPDATE SET assigned_to_id=EXCLUDED.assigned_to_id,assignment_origin='TODAY_ONLY',reservation_stay_id=EXCLUDED.reservation_stay_id,cleaning_type=EXCLUDED.cleaning_type,planned_minutes=EXCLUDED.planned_minutes,updated_at=NOW() WHERE housekeeping_room_assignments.completed_at IS NULL`;
}

async function assignExtraToday(prisma: PrismaClient, hotelTenantId: string, date: string, extra: ExtraCatalog, employeeId: string) {
  const description = extra.descriptionEn || extra.descriptionDe || extra.descriptionIt;
  await prisma.$executeRaw`INSERT INTO housekeeping_extra_job_assignments (id,hotel_tenant_id,work_date,extra_job_id,assigned_to_id,planned_minutes,assignment_origin,description_snapshot,updated_at) VALUES (${randomUUID()}::uuid,${hotelTenantId}::uuid,${date}::date,${extra.id}::uuid,${employeeId}::uuid,${extra.minutes},'TODAY_ONLY'::"HousekeepingAssignmentOrigin",${description},NOW()) ON CONFLICT (hotel_tenant_id,work_date,extra_job_id,assigned_to_id) DO UPDATE SET assignment_origin='TODAY_ONLY',planned_minutes=EXCLUDED.planned_minutes,description_snapshot=EXCLUDED.description_snapshot,updated_at=NOW() WHERE housekeeping_extra_job_assignments.completed_at IS NULL`;
}

export async function runHousekeepingAiAllocation(prisma: PrismaClient, hotelTenantId: string, timeZone: string) {
  const date = hotelLocalDate(timeZone.trim() || "UTC");
  const facts = await collectFacts(prisma, hotelTenantId, date);
  const employeeIds = new Set(facts.employees.map((employee) => employee.id));
  const roomById = new Map(facts.rooms.map((room) => [room.roomId, room]));
  let plan = fallbackPlan(facts);
  try {
    const parsed = await completeJson([
      {
        role: "system",
        content: "You allocate hotel housekeeping work for today. Use only the JSON facts. Never invent rooms, employees, or extra job ids. Extra jobs are always for today only (not permanent). Prefer extraCatalog ids. Create a new extra only when nothing in the catalog matches. Return JSON only.",
      },
      {
        role: "user",
        content: `Assign rooms and extra jobs for ${facts.date}.
Rules:
- Only use employee ids from employees.
- Only assign rooms from rooms; skip noService and completed.
- Keep existing assignedToId unless the load is very uneven or a VIP/birthday/departure needs a stronger cleaner.
- Balance toward 480 minutes.
- Use weather, VIP, birthdays, reservation notes, yesterday and tomorrow arrivals/departures, DND, breakfast-in-room, and room moves (fromRoom/toRoom) to decide extras.
- extras[].extraId must be from extraCatalog when a listed job fits (windows, corridors, sauna, etc.).
- If you must create a job, set description plus descriptionEn/De/It and minutes 10-60.
- Max 8 extras. Do not duplicate extrasAlreadyAssigned unless more people are needed.
Return {"rooms":[{"roomId":"...","employeeId":"..."}],"extras":[{"extraId":"...","employeeIds":["..."],"reason":"..."}]}\n\nFacts:\n${JSON.stringify(facts).slice(0, 24000)}`,
      },
    ]);
    const fromModel = parsePlan(parsed);
    if (fromModel.rooms.length || fromModel.extras.length) plan = fromModel;
  } catch {
    plan = fallbackPlan(facts);
  }

  let roomsAssigned = 0;
  let extrasAssigned = 0;
  let extrasCreated = 0;
  const catalog = [...facts.extraCatalog];

  for (const row of plan.rooms) {
    if (!employeeIds.has(row.employeeId)) continue;
    const room = roomById.get(row.roomId);
    if (!room || room.noService || room.completed) continue;
    await assignRoomToday(prisma, hotelTenantId, date, room.roomId, row.employeeId, {
      id: room.stayId,
      minutes: room.minutes,
      cleaningType: room.cleaningType,
    });
    roomsAssigned += 1;
  }

  const already = new Set(facts.extrasAlreadyAssigned.map((row) => `${row.extraJobId}:${row.employeeId}`));
  for (const item of plan.extras) {
    let extra = matchExtra(catalog, item.extraId, item.description || item.descriptionEn);
    if (!extra) {
      const minutes = Math.max(10, Math.min(60, Math.round(item.minutes || 20)));
      const descriptionEn = item.descriptionEn || item.description || "Extra job";
      extra = await prisma.extraJob.create({
        data: {
          hotelTenantId,
          descriptionEn,
          descriptionDe: item.descriptionDe || descriptionEn,
          descriptionIt: item.descriptionIt || descriptionEn,
          minutes,
        },
      });
      catalog.push(extra);
      extrasCreated += 1;
    }
    for (const employeeId of item.employeeIds) {
      if (!employeeIds.has(employeeId)) continue;
      const key = `${extra.id}:${employeeId}`;
      if (already.has(key)) continue;
      await assignExtraToday(prisma, hotelTenantId, date, extra, employeeId);
      already.add(key);
      extrasAssigned += 1;
    }
  }

  return { date, roomsAssigned, extrasAssigned, extrasCreated, usedModel: Boolean(process.env.OPENAI_API_KEY?.trim()) };
}
