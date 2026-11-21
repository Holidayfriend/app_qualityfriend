import type { Locale } from "../i18n/dictionaries";
import { spanMinutes } from "./shift-rules";
import { addDaysIso, formatDayHeader } from "./week";

export type DepartmentKind = "housekeeping" | "reception" | "kitchen" | "service" | "spa" | "admin" | "other";

export type DayMovement = {
  date: string;
  arrivals: number;
  departures: number;
  stayovers: number;
  occupied: number;
};

export type PlanPerson = {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  weeklyDays: number;
  weeklyHours: number | null;
};

export type PlanShift = {
  userId: string;
  date: string;
  kind: "work" | "off" | "vac";
  start: string;
  end: string;
  breakMins: number;
  leaveCategory: string;
};

export type PlanTemplate = {
  id: string;
  name: string;
  start: string;
  end: string;
  breakMins: number;
};

export type BlockReason = "vacation" | "sick" | "off" | "contract" | "streak" | "rest";

export type PlannedShift = {
  userId: string;
  name: string;
  date: string;
  start: string;
  end: string;
  breakMins: number;
  templateId: string;
  departmentId: string;
  department: string;
};

export type PlanProblem = {
  date: string;
  department: string;
  needed: number;
  scheduled: number;
  blocked: { name: string; reason: BlockReason }[];
};

type Hours = { start: string; end: string; breakMins: number; templateId: string };

const MAX_RUN = 6;
const MIN_REST = 11 * 60;
const FALLBACK: Hours = { start: "08:00", end: "16:00", breakMins: 30, templateId: "" };

const REASON_ORDER: BlockReason[] = ["vacation", "sick", "off", "contract", "streak", "rest"];

function fold(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");
}

export function departmentKind(name: string): DepartmentKind {
  const text = fold(name);
  if (/housekeep|zimmer|etage|reinig|puliz|camere/.test(text)) return "housekeeping";
  if (/kuche|kitchen|cucina|koch/.test(text)) return "kitchen";
  if (/rezept|reception|front office|ricezion|empfang/.test(text)) return "reception";
  if (/spa|wellness|massage/.test(text)) return "spa";
  if (/service|restaurant|dining|kellner|sala\b/.test(text)) return "service";
  if (/admin|verwalt|office|buro|direktion|management/.test(text)) return "admin";
  return "other";
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/** How many people this department needs from the day's ASA movement. */
export function staffNeeded(kind: DepartmentKind, day: DayMovement) {
  const arrivals = Math.max(0, day.arrivals);
  const departures = Math.max(0, day.departures);
  const stayovers = Math.max(0, day.stayovers);
  const occupied = Math.max(0, day.occupied);
  if (kind === "housekeeping") {
    if (arrivals + departures + stayovers === 0) return 0;
    const points = departures + stayovers * 0.35 + arrivals * 0.2;
    let needed = Math.max(1, Math.ceil(points / 3));
    if (departures > 0 && departures <= 6) needed = Math.max(needed, 2);
    return needed;
  }
  if (kind === "reception") {
    if (arrivals + departures + occupied === 0) return 0;
    const points = arrivals * 1.4 + departures + occupied * 0.05;
    return Math.max(1, Math.ceil(points / 16));
  }
  if (kind === "kitchen") {
    if (occupied === 0) return 0;
    return Math.max(1, Math.ceil(occupied / 24));
  }
  if (kind === "service") {
    if (occupied === 0) return 0;
    return Math.max(1, Math.ceil(occupied / 20));
  }
  if (kind === "spa") {
    if (occupied < 8) return 0;
    return Math.max(1, Math.ceil(occupied / 28));
  }
  if (kind === "admin") return weekday(day.date) === 0 || weekday(day.date) === 6 ? 0 : 1;
  if (arrivals + departures + occupied === 0) return 0;
  return 1;
}

function clockMins(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours > 23) return null;
  return hours * 60 + Number(match[2]);
}

function netHours(hours: Hours) {
  const mins = spanMinutes(hours.start, hours.end);
  if (mins == null) return 0;
  return Math.max(0, mins - Math.max(0, hours.breakMins)) / 60;
}

function restMinutes(previous: Hours, next: Hours) {
  const from = clockMins(previous.start);
  const span = spanMinutes(previous.start, previous.end);
  const nextStart = clockMins(next.start);
  if (from == null || span == null || nextStart == null) return MIN_REST;
  return 24 * 60 + nextStart - (from + span);
}

function runLength(dates: Set<string>, date: string) {
  let count = 1;
  let cursor = addDaysIso(date, -1);
  while (dates.has(cursor)) {
    count += 1;
    cursor = addDaysIso(cursor, -1);
  }
  cursor = addDaysIso(date, 1);
  while (dates.has(cursor)) {
    count += 1;
    cursor = addDaysIso(cursor, 1);
  }
  return count;
}

function asHours(start: string, end: string, breakMins: number, templateId = ""): Hours | null {
  if (clockMins(start) == null || clockMins(end) == null) return null;
  return { start: start.slice(0, 5), end: end.slice(0, 5), breakMins: Math.max(0, breakMins), templateId };
}

export function planWeek(input: {
  dates: string[];
  people: PlanPerson[];
  shifts: PlanShift[];
  priorShifts: PlanShift[];
  absences: { userId: string; date: string; reason: "vacation" | "sick" | "off" }[];
  movements: DayMovement[];
  templates: PlanTemplate[];
}) {
  const dates = [...input.dates];
  const week = new Set(dates);
  const movementOf = new Map(input.movements.map((day) => [day.date, day]));
  const emptyDay = (date: string): DayMovement => movementOf.get(date) ?? { date, arrivals: 0, departures: 0, stayovers: 0, occupied: 0 };

  const groups = new Map<string, { id: string; name: string; kind: DepartmentKind; people: PlanPerson[] }>();
  for (const person of input.people) {
    if (!person.departmentId) continue;
    const group = groups.get(person.departmentId) ?? {
      id: person.departmentId,
      name: person.departmentName || person.departmentId,
      kind: departmentKind(person.departmentName),
      people: [],
    };
    group.people.push({ ...person, weeklyDays: Math.min(MAX_RUN, Math.max(1, Math.round(person.weeklyDays) || 5)) });
    groups.set(person.departmentId, group);
  }

  const away = new Map<string, "vacation" | "sick" | "off">();
  for (const shift of [...input.priorShifts, ...input.shifts]) {
    if (shift.kind === "vac") away.set(`${shift.userId}|${shift.date}`, "vacation");
    else if (shift.kind === "off") away.set(`${shift.userId}|${shift.date}`, shift.leaveCategory === "paidSick" ? "sick" : "off");
  }
  for (const absence of input.absences) away.set(`${absence.userId}|${absence.date}`, absence.reason);

  const duty = new Map<string, Hours>();
  const workDates = new Map<string, Set<string>>();
  const weekDays = new Map<string, number>();
  const weekHours = new Map<string, number>();
  const coverage = new Map<string, number>();

  function rememberWork(shift: PlanShift, countInWeek: boolean) {
    if (shift.kind !== "work") return;
    const hours = asHours(shift.start, shift.end, shift.breakMins);
    if (!hours) return;
    duty.set(`${shift.userId}|${shift.date}`, hours);
    const datesForUser = workDates.get(shift.userId) ?? new Set<string>();
    datesForUser.add(shift.date);
    workDates.set(shift.userId, datesForUser);
    if (!countInWeek || !week.has(shift.date)) return;
    weekDays.set(shift.userId, (weekDays.get(shift.userId) ?? 0) + 1);
    weekHours.set(shift.userId, (weekHours.get(shift.userId) ?? 0) + netHours(hours));
    const person = input.people.find((item) => item.id === shift.userId);
    if (!person?.departmentId) return;
    const key = `${person.departmentId}|${shift.date}`;
    coverage.set(key, (coverage.get(key) ?? 0) + 1);
  }
  for (const shift of input.priorShifts) rememberWork(shift, false);
  for (const shift of input.shifts) rememberWork(shift, true);

  const templatesByGroup = new Map<string, Hours[]>();
  function templatesFor(group: { id: string; name: string; kind: DepartmentKind; people: PlanPerson[] }) {
    const cached = templatesByGroup.get(group.id);
    if (cached) return cached;
    const starts = group.people.flatMap((person) => dates.flatMap((date) => {
      const hours = duty.get(`${person.id}|${date}`);
      return hours ? [clockMins(hours.start) ?? 0] : [];
    }));
    const preferred = starts.sort((left, right) => left - right)[Math.floor(starts.length / 2)] ?? null;
    const ranked = input.templates.flatMap((template) => {
      const hours = asHours(template.start, template.end, template.breakMins, template.id);
      if (!hours) return [];
      const name = fold(template.name);
      const dept = fold(group.name);
      const named = dept && (name.includes(dept) || dept.includes(name)) ? 0 : 1;
      const start = clockMins(hours.start) ?? 0;
      const distance = preferred == null ? start : Math.abs(start - preferred);
      return [{ hours, named, distance, start }];
    }).sort((left, right) => left.named - right.named || left.distance - right.distance || left.start - right.start);
    const usable = ranked.some((item) => item.named === 0) ? ranked.filter((item) => item.named === 0) : ranked;
    const hours = usable.length ? usable.map((item) => item.hours) : [FALLBACK];
    templatesByGroup.set(group.id, hours);
    return hours;
  }

  function restOk(userId: string, date: string, hours: Hours) {
    const previous = duty.get(`${userId}|${addDaysIso(date, -1)}`);
    const next = duty.get(`${userId}|${addDaysIso(date, 1)}`);
    if (previous && restMinutes(previous, hours) < MIN_REST) return false;
    if (next && restMinutes(hours, next) < MIN_REST) return false;
    return true;
  }

  function fitting(person: PlanPerson, date: string, options: Hours[]) {
    if (away.has(`${person.id}|${date}`) || duty.has(`${person.id}|${date}`)) return null;
    if ((weekDays.get(person.id) ?? 0) >= person.weeklyDays) return null;
    const worked = workDates.get(person.id) ?? new Set<string>();
    if (runLength(worked, date) > MAX_RUN) return null;
    for (const hours of options) {
      if (!restOk(person.id, date, hours)) continue;
      if (person.weeklyHours != null && (weekHours.get(person.id) ?? 0) + netHours(hours) > person.weeklyHours + 0.05) continue;
      return hours;
    }
    return null;
  }

  function explain(person: PlanPerson, date: string, options: Hours[]): BlockReason | null {
    if (duty.has(`${person.id}|${date}`)) return null;
    const absence = away.get(`${person.id}|${date}`);
    if (absence) return absence;
    if ((weekDays.get(person.id) ?? 0) >= person.weeklyDays) return "contract";
    const worked = workDates.get(person.id) ?? new Set<string>();
    if (runLength(worked, date) > MAX_RUN) return "streak";
    const hoursBlocked = person.weeklyHours != null && options.every((hours) => (weekHours.get(person.id) ?? 0) + netHours(hours) > person.weeklyHours! + 0.05);
    if (hoursBlocked) return "contract";
    if (!options.some((hours) => restOk(person.id, date, hours))) return "rest";
    return null;
  }

  const proposals: PlannedShift[] = [];
  const problems: PlanProblem[] = [];
  const orderedGroups = [...groups.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const rankedDates = [...dates].sort((left, right) => {
    const load = (date: string) => orderedGroups.reduce((total, group) => total + staffNeeded(group.kind, emptyDay(date)), 0);
    return load(right) - load(left) || left.localeCompare(right);
  });

  for (const date of rankedDates) {
    for (const group of orderedGroups) {
      const needed = staffNeeded(group.kind, emptyDay(date));
      if (needed <= 0) continue;
      const options = templatesFor(group);
      const key = `${group.id}|${date}`;
      let covered = coverage.get(key) ?? 0;
      const candidates = group.people
        .flatMap((person) => {
          const hours = fitting(person, date, options);
          return hours ? [{ person, hours }] : [];
        })
        .sort((left, right) => (weekDays.get(left.person.id) ?? 0) - (weekDays.get(right.person.id) ?? 0) || left.person.name.localeCompare(right.person.name) || left.person.id.localeCompare(right.person.id));
      for (const candidate of candidates) {
        if (covered >= needed) break;
        const { person, hours } = candidate;
        duty.set(`${person.id}|${date}`, hours);
        const worked = workDates.get(person.id) ?? new Set<string>();
        worked.add(date);
        workDates.set(person.id, worked);
        weekDays.set(person.id, (weekDays.get(person.id) ?? 0) + 1);
        weekHours.set(person.id, (weekHours.get(person.id) ?? 0) + netHours(hours));
        covered += 1;
        proposals.push({
          userId: person.id,
          name: person.name,
          date,
          start: hours.start,
          end: hours.end,
          breakMins: hours.breakMins,
          templateId: hours.templateId,
          departmentId: group.id,
          department: group.name,
        });
      }
      coverage.set(key, covered);
      if (covered >= needed) continue;
      const blocked = group.people.flatMap((person) => {
        const reason = explain(person, date, options);
        return reason ? [{ name: person.name, reason }] : [];
      }).sort((left, right) => REASON_ORDER.indexOf(left.reason) - REASON_ORDER.indexOf(right.reason) || left.name.localeCompare(right.name));
      problems.push({ date, department: group.name, needed, scheduled: covered, blocked });
    }
  }

  proposals.sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
  problems.sort((left, right) => left.date.localeCompare(right.date) || left.department.localeCompare(right.department));
  return { proposals, problems };
}

function reasonText(reason: BlockReason, name: string, locale: Locale) {
  const lines = {
    en: { vacation: `${name} on vacation`, sick: `${name} sick`, off: `${name} off`, contract: `${name} is at the weekly contract`, streak: `${name} would work 7 days in a row`, rest: `${name} would not get the minimum rest` },
    de: { vacation: `${name} im Urlaub`, sick: `${name} krank`, off: `${name} frei`, contract: `${name} hat die Vertragstage erreicht`, streak: `${name} hätte 7 Tage in Folge`, rest: `${name} hätte zu wenig Ruhezeit` },
    it: { vacation: `${name} in ferie`, sick: `${name} malato`, off: `${name} libero`, contract: `${name} ha raggiunto i giorni del contratto`, streak: `${name} lavorerebbe 7 giorni di fila`, rest: `${name} non avrebbe il riposo minimo` },
  } as const;
  return lines[locale][reason];
}

export function describePlan(problems: PlanProblem[], locale: Locale, hasShifts: boolean) {
  if (!problems.length) {
    if (!hasShifts) {
      if (locale === "de") return { title: "Nichts zu planen", body: "Für diese Woche gibt es keine offenen Schichten." };
      if (locale === "it") return { title: "Niente da pianificare", body: "Non ci sono turni aperti per questa settimana." };
      return { title: "Nothing to plan", body: "There are no open shifts for this week." };
    }
    if (locale === "de") return { title: "KI-Entwurf", body: "Entwürfe folgen Anreisen, Abreisen und Bleibern. Urlaub und frei bleiben leer. Gespeichert wird erst mit Annehmen." };
    if (locale === "it") return { title: "Bozza IA", body: "Le bozze seguono arrivi, partenze e soggiorni. Ferie e riposi restano vuoti. Si salva solo con Accetta." };
    return { title: "AI draft", body: "Drafts follow arrivals, departures and stayovers. Vacation and days off stay empty. Nothing is saved until you accept." };
  }
  const sentences = problems.slice(0, 6).map((problem) => {
    const day = formatDayHeader(problem.date, locale);
    const why = problem.blocked.slice(0, 3).map((item) => reasonText(item.reason, item.name, locale)).join(", ");
    if (locale === "de") return why
      ? `${day}: nur ${problem.scheduled} von ${problem.needed} benötigten Mitarbeitern verfügbar (${why}), bitte prüfen.`
      : `${day}: nur ${problem.scheduled} von ${problem.needed} benötigten Mitarbeitern verfügbar, bitte prüfen.`;
    if (locale === "it") return why
      ? `${day}: solo ${problem.scheduled} di ${problem.needed} collaboratori necessari disponibili (${why}), da controllare.`
      : `${day}: solo ${problem.scheduled} di ${problem.needed} collaboratori necessari disponibili, da controllare.`;
    return why
      ? `${day}: only ${problem.scheduled} of ${problem.needed} needed staff available (${why}), please check.`
      : `${day}: only ${problem.scheduled} of ${problem.needed} needed staff available, please check.`;
  });
  const extra = problems.length > 6 ? (locale === "de" ? ` +${problems.length - 6}` : ` +${problems.length - 6}`) : "";
  if (locale === "de") return { title: "Bitte prüfen", body: `${sentences.join(" ")}${extra}` };
  if (locale === "it") return { title: "Da controllare", body: `${sentences.join(" ")}${extra}` };
  return { title: "Please check", body: `${sentences.join(" ")}${extra}` };
}
