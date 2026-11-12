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

export type ShiftProposal = {
  userId: string;
  name: string;
  date: string;
  start: string;
  end: string;
  department: string;
  reason: "sameHours" | "housekeeping" | "cover";
  coverName: string;
};

type Hours = { start: string; end: string };

const MAX_WORK_DAYS = 6;

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

export function proposeShifts(input: {
  dates: string[];
  people: ProposalPerson[];
  shifts: ProposalShift[];
  rooms: ProposalRooms[];
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

  return [...proposed.values()].sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name)).slice(0, 40);
}
