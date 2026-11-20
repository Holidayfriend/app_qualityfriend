export type ProposalPerson = {
  id: string;
  name: string;
  departments: string[];
  housekeeper: boolean;
};

export type ProposalShift = {
  userId: string;
  date: string;
  kind: "work" | "off" | "vac";
  start: string;
  end: string;
};

export type ProposalRooms = {
  date: string;
  userId: string | null;
  rooms: number;
};

export type WeekDemand = {
  occupiedByDate: Record<string, number>;
  capacity: number;
  temperatureC: number | null;
};

export type ShiftProposal = {
  userId: string;
  name: string;
  date: string;
  start: string;
  end: string;
  department: string;
  reason: "sameHours" | "housekeeping" | "cover" | "week";
  coverName: string;
};

type Hours = { start: string; end: string };

const MAX_WORK_DAYS = 6;
const DEFAULT_HOURS: Hours = { start: "08:00", end: "16:00" };

function clock(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function asHours(start: string, end: string): Hours | null {
  const from = clock(start);
  const to = clock(end);
  return from && to ? { start: from, end: to } : null;
}

function mostCommon(rows: Hours[]) {
  const counts = new Map<string, { hours: Hours; n: number }>();
  for (const hours of rows) {
    const key = `${hours.start}|${hours.end}`;
    const current = counts.get(key);
    if (current) current.n += 1;
    else counts.set(key, { hours, n: 1 });
  }
  return [...counts.values()].sort((left, right) => right.n - left.n)[0]?.hours ?? null;
}

function monthOf(date: string) {
  return Number(date.slice(5, 7));
}

function dayLoad(date: string, demand: WeekDemand | undefined) {
  const occupied = demand?.occupiedByDate[date] ?? 0;
  const capacity = demand?.capacity ?? 0;
  const occupancy = capacity > 0 ? occupied / capacity : 0;
  const month = monthOf(date);
  let level = occupancy;
  if ([1, 2, 6, 7, 8, 12].includes(month)) level += 0.2;
  else if ([3, 5, 9, 11].includes(month)) level += 0.1;
  const temperature = demand?.temperatureC;
  if (temperature != null && (temperature >= 26 || temperature <= 0)) level += 0.1;
  return { occupied, level: Math.min(1, level) };
}

function staffNeeded(available: number, occupied: number, level: number, housekeeping: boolean) {
  if (available <= 0) return 0;
  if (housekeeping) {
    const byRooms = occupied <= 0 ? 1 : Math.max(1, Math.ceil(occupied / 12));
    return Math.min(available, level >= 0.85 ? byRooms + 1 : byRooms);
  }
  if (available === 1) return 1;
  if (level >= 0.75) return Math.min(available, Math.max(2, Math.ceil(available * 0.6)));
  return Math.min(available, Math.max(1, Math.ceil(available * 0.5)));
}

export function proposeShifts(input: {
  dates: string[];
  people: ProposalPerson[];
  shifts: ProposalShift[];
  rooms: ProposalRooms[];
  demand?: WeekDemand;
  defaultHours?: Hours;
}) {
  const shiftOn = new Map<string, ProposalShift>();
  for (const shift of input.shifts) shiftOn.set(`${shift.userId}|${shift.date}`, shift);
  const roomCount = new Map<string, number>();
  for (const row of input.rooms) {
    if (!row.userId || row.rooms <= 0) continue;
    const key = `${row.userId}|${row.date}`;
    roomCount.set(key, (roomCount.get(key) ?? 0) + row.rooms);
  }
  const openRooms = new Map<string, number>();
  for (const row of input.rooms) {
    if (row.userId || row.rooms <= 0) continue;
    openRooms.set(row.date, (openRooms.get(row.date) ?? 0) + row.rooms);
  }

  const cell = (userId: string, date: string) => shiftOn.get(`${userId}|${date}`);
  const away = (userId: string, date: string) => {
    const shift = cell(userId, date);
    return shift?.kind === "vac" || shift?.kind === "off";
  };
  const workDays = new Map<string, number>();
  for (const person of input.people) {
    workDays.set(person.id, input.dates.filter((date) => cell(person.id, date)?.kind === "work").length);
  }
  const proposed = new Map<string, ShiftProposal>();

  function hoursOf(userId: string) {
    return mostCommon(input.dates.flatMap((date) => {
      const shift = cell(userId, date);
      if (shift?.kind !== "work") return [];
      const hours = asHours(shift.start, shift.end);
      return hours ? [hours] : [];
    }));
  }

  function departmentHours(department: string) {
    const members = input.people.filter((person) => person.departments.includes(department));
    return mostCommon(members.flatMap((person) => {
      const hours = hoursOf(person.id);
      return hours ? [hours] : [];
    }));
  }

  function hotelHours() {
    return mostCommon(input.people.flatMap((person) => {
      const hours = hoursOf(person.id);
      return hours ? [hours] : [];
    }));
  }

  function add(person: ProposalPerson, date: string, hours: Hours, reason: ShiftProposal["reason"], department: string, coverName = "") {
    const key = `${person.id}|${date}`;
    if (proposed.has(key) || cell(person.id, date) || away(person.id, date)) return false;
    if ((workDays.get(person.id) ?? 0) >= MAX_WORK_DAYS) return false;
    proposed.set(key, {
      userId: person.id,
      name: person.name,
      date,
      start: hours.start,
      end: hours.end,
      department,
      reason,
      coverName,
    });
    workDays.set(person.id, (workDays.get(person.id) ?? 0) + 1);
    return true;
  }

  for (const person of input.people) {
    if (!person.housekeeper) continue;
    const own = hoursOf(person.id);
    const department = person.departments[0] || "Housekeeping";
      const hours = own || departmentHours(department) || hotelHours();
    if (!hours) continue;
    for (const date of input.dates) {
      if ((roomCount.get(`${person.id}|${date}`) ?? 0) <= 0) continue;
      add(person, date, hours, "housekeeping", department);
    }
  }

  for (const person of input.people) {
    const hours = hoursOf(person.id);
    if (!hours) continue;
    for (const date of input.dates) add(person, date, hours, "sameHours", person.departments[0] || "");
  }

  const departments = [...new Set(input.people.flatMap((person) => person.departments))];
  for (const date of input.dates) {
    for (const department of departments) {
      const members = input.people.filter((person) => person.departments.includes(department));
      const absent = members.filter((person) => away(person.id, date));
      if (!absent.length) continue;
      const covered = members.some((person) => cell(person.id, date)?.kind === "work" || proposed.has(`${person.id}|${date}`));
      if (covered) continue;
      const hours = mostCommon(absent.flatMap((person) => {
        const usual = hoursOf(person.id);
        return usual ? [usual] : [];
      })) || departmentHours(department) || hotelHours();
      if (!hours) continue;
      const candidate = members.find((person) => !cell(person.id, date) && !proposed.has(`${person.id}|${date}`) && (workDays.get(person.id) ?? 0) < MAX_WORK_DAYS);
      if (!candidate) continue;
      add(candidate, date, hours, "cover", department, absent[0].name);
    }

    const housekeepingNeeded = input.people.some((person) => person.housekeeper && away(person.id, date) && (roomCount.get(`${person.id}|${date}`) ?? 0) > 0)
      || (openRooms.get(date) ?? 0) > 0;
    const housekeepingCovered = input.people.some((person) => person.housekeeper && (cell(person.id, date)?.kind === "work" || proposed.has(`${person.id}|${date}`)));
    if (!housekeepingNeeded || housekeepingCovered) continue;
    const absent = input.people.find((person) => person.housekeeper && away(person.id, date));
    const hours = (absent ? hoursOf(absent.id) : null) || mostCommon(input.people.filter((person) => person.housekeeper).flatMap((person) => {
      const usual = hoursOf(person.id);
      return usual ? [usual] : [];
    })) || hotelHours();
    if (!hours) continue;
    const candidate = input.people.find((person) => person.housekeeper && !cell(person.id, date) && !proposed.has(`${person.id}|${date}`) && (workDays.get(person.id) ?? 0) < MAX_WORK_DAYS);
    if (!candidate) continue;
    add(candidate, date, hours, absent ? "cover" : "housekeeping", candidate.departments[0] || "Housekeeping", absent?.name || "");
  }

  const fallbackHours = input.defaultHours && asHours(input.defaultHours.start, input.defaultHours.end) || DEFAULT_HOURS;
  const groups = new Map<string, ProposalPerson[]>();
  for (const person of input.people) {
    const department = person.departments[0] || "";
    const members = groups.get(department) ?? [];
    members.push(person);
    groups.set(department, members);
  }
  for (const [department, members] of groups) {
    const ordered = [...members].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    const housekeeping = ordered.some((person) => person.housekeeper);
    const hoursFor = (person: ProposalPerson) => hoursOf(person.id) || departmentHours(department) || hotelHours() || fallbackHours;
    for (const [index, person] of ordered.entries()) {
      const off = new Set<number>();
      if (ordered.length > 1) {
        off.add(index % input.dates.length);
        off.add((index + 3) % input.dates.length);
      } else if (input.dates.length >= 7) off.add(input.dates.length - 1);
      const hours = hoursFor(person);
      for (let day = 0; day < input.dates.length; day += 1) {
        if (off.has(day)) continue;
        add(person, input.dates[day], hours, "week", department);
      }
    }
    for (let day = 0; day < input.dates.length; day += 1) {
      const date = input.dates[day];
      const free = ordered.filter((person) => !away(person.id, date));
      const working = ordered.filter((person) => cell(person.id, date)?.kind === "work" || proposed.has(`${person.id}|${date}`));
      const load = dayLoad(date, input.demand);
      const need = staffNeeded(free.length, load.occupied, load.level, housekeeping);
      if (working.length >= need) continue;
      const absent = ordered.find((person) => away(person.id, date));
      const candidates = ordered
        .filter((person) => !cell(person.id, date) && !proposed.has(`${person.id}|${date}`) && !away(person.id, date) && (workDays.get(person.id) ?? 0) < MAX_WORK_DAYS)
        .sort((left, right) => (workDays.get(left.id) ?? 0) - (workDays.get(right.id) ?? 0) || left.name.localeCompare(right.name));
      let covered = working.length;
      for (const person of candidates) {
        if (covered >= need) break;
        if (add(person, date, hoursFor(person), absent ? "cover" : "week", department, absent?.name || "")) covered += 1;
      }
    }
  }

  return [...proposed.values()].sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name)).slice(0, 200);
}
