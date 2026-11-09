export type OpsPerson = { name: string; kind: "off" | "vac" };
export type OpsTaskRank = "overdue" | "today" | "soon" | "later" | "none";
export type OpsTask = {
  title: string;
  due: string;
  rank: OpsTaskRank;
  assignee: string;
  department: string;
};
export type OpsFacts = {
  asOf: string;
  arrivals: number;
  departures: number;
  vipArrivals: Array<{ room: string; name: string }>;
  expressRooms: Array<{ number: string; deadline: string }>;
  noServiceRooms: string[];
  occupancy: number;
  absentToday: OpsPerson[];
  absentTomorrow: OpsPerson[];
  openTasks: OpsTask[];
  openExtraJobs: Array<{ title: string; assignee: string }>;
};

export type BriefingBodies = { bodyEn: string; bodyDe: string; bodyIt: string };

type Lang = "en" | "de" | "it";

export const HANDOVER_LABELS: Record<Lang, { focus: string; open: string; staff: string }> = {
  en: { focus: "Today's focus:", open: "Open items:", staff: "Staff note:" },
  de: { focus: "Heute im Fokus:", open: "Offene Punkte:", staff: "Personalhinweis:" },
  it: { focus: "Oggi in evidenza:", open: "Punti aperti:", staff: "Nota sul personale:" },
};

const AND: Record<Lang, string> = { en: "and", de: "und", it: "e" };

function joinAnd(items: string[], and: string) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

function listed(items: string[], extra: number, lang: Lang) {
  const and = AND[lang];
  const more = lang === "de" ? `${extra} weitere` : lang === "it" ? `altri ${extra}` : `${extra} more`;
  if (!extra) return joinAnd(items, and);
  if (items.length === 0) return more;
  return `${items.join(", ")} ${and} ${more}`;
}

function rankWord(rank: OpsTaskRank, lang: Lang) {
  const words: Record<OpsTaskRank, Record<Lang, string>> = {
    overdue: { en: "overdue", de: "überfällig", it: "in ritardo" },
    today: { en: "due today", de: "heute fällig", it: "in scadenza oggi" },
    soon: { en: "due this week", de: "diese Woche fällig", it: "in scadenza questa settimana" },
    later: { en: "due later", de: "später fällig", it: "in scadenza più avanti" },
    none: { en: "no due date", de: "ohne Datum", it: "senza scadenza" },
  };
  return words[rank][lang];
}

export function priorityTasks(facts: OpsFacts) {
  const order: Record<OpsTaskRank, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 };
  return [...facts.openTasks].sort((left, right) => order[left.rank] - order[right.rank] || left.due.localeCompare(right.due) || left.title.localeCompare(right.title));
}

function expressClause(facts: OpsFacts, lang: Lang) {
  const rooms = facts.expressRooms.slice(0, 6);
  if (!rooms.length) return "";
  const numbers = listed(rooms.map((room) => room.number), Math.max(0, facts.expressRooms.length - rooms.length), lang);
  const shared = rooms.every((room) => room.deadline && room.deadline === rooms[0].deadline) ? rooms[0].deadline : "";
  if (shared) {
    if (lang === "de") return `Zimmer ${numbers} brauchen Express-Reinigung vor ${shared}.`;
    if (lang === "it") return `Le camere ${numbers} richiedono pulizia express prima delle ${shared}.`;
    return `Rooms ${numbers} need express cleaning before ${shared}.`;
  }
  const detail = rooms.map((room) => room.deadline
    ? (lang === "de" ? `${room.number} vor ${room.deadline}` : lang === "it" ? `${room.number} prima delle ${room.deadline}` : `${room.number} before ${room.deadline}`)
    : room.number);
  if (lang === "de") return `Express-Reinigung: ${detail.join(", ")}.`;
  if (lang === "it") return `Pulizia express: ${detail.join(", ")}.`;
  return `Express cleaning: ${detail.join(", ")}.`;
}

function absenceSentence(people: OpsPerson[], when: "today" | "tomorrow", lang: Lang) {
  if (!people.length) return "";
  const groups: Array<{ kind: OpsPerson["kind"]; people: OpsPerson[] }> = [
    { kind: "off", people: people.filter((person) => person.kind === "off") },
    { kind: "vac", people: people.filter((person) => person.kind === "vac") },
  ];
  return groups.map((group) => {
    if (!group.people.length) return "";
    const shown = group.people.slice(0, 4).map((person) => person.name);
    const extra = group.people.length - shown.length;
    const names = listed(shown, extra, lang);
    const many = shown.length + extra > 1;
    if (lang === "de") {
      const day = when === "today" ? "heute" : "morgen";
      if (group.kind === "vac") return many ? `${names} sind ${day} im Urlaub.` : `${names} ist ${day} im Urlaub.`;
      return many ? `${names} haben ${day} frei.` : `${names} hat ${day} frei.`;
    }
    if (lang === "it") {
      const day = when === "today" ? "oggi" : "domani";
      if (group.kind === "vac") return many ? `${names} sono in ferie ${day}.` : `${names} è in ferie ${day}.`;
      return many ? `${names} sono assenti ${day}.` : `${names} è assente ${day}.`;
    }
    const day = when === "today" ? "today" : "tomorrow";
    if (group.kind === "vac") return many ? `${names} are on vacation ${day}.` : `${names} is on vacation ${day}.`;
    return many ? `${names} are off ${day}.` : `${names} is off ${day}.`;
  }).filter(Boolean).join(" ");
}

function staffSentences(facts: OpsFacts, lang: Lang) {
  return [absenceSentence(facts.absentToday, "today", lang), absenceSentence(facts.absentTomorrow, "tomorrow", lang)].filter(Boolean).join(" ");
}

function noServiceClause(facts: OpsFacts, lang: Lang) {
  if (!facts.noServiceRooms.length) return "";
  const rooms = listed(facts.noServiceRooms.slice(0, 6), Math.max(0, facts.noServiceRooms.length - 6), lang);
  if (lang === "de") return `Kein Service: Zimmer ${rooms}.`;
  if (lang === "it") return `Nessun servizio: camere ${rooms}.`;
  return `No service: rooms ${rooms}.`;
}

function arrivalSentence(facts: OpsFacts, lang: Lang) {
  const vip = facts.vipArrivals.slice(0, 3);
  const vipNames = vip.map((guest) => guest.name ? `${guest.room} ${guest.name}` : guest.room).filter(Boolean).join("; ");
  if (lang === "de") {
    const base = `${facts.arrivals} Ankünfte und ${facts.departures} Abgänge heute.`;
    if (!facts.vipArrivals.length) return base;
    return `${facts.arrivals} Ankünfte, darunter ${facts.vipArrivals.length} VIP${vipNames ? ` (${vipNames})` : ""}, und ${facts.departures} Abgänge heute.`;
  }
  if (lang === "it") {
    const base = `${facts.arrivals} arrivi e ${facts.departures} partenze oggi.`;
    if (!facts.vipArrivals.length) return base;
    return `${facts.arrivals} arrivi, di cui ${facts.vipArrivals.length} VIP${vipNames ? ` (${vipNames})` : ""}, e ${facts.departures} partenze oggi.`;
  }
  const base = `${facts.arrivals} arrivals and ${facts.departures} departures today.`;
  if (!facts.vipArrivals.length) return base;
  return `${facts.arrivals} arrivals, including ${facts.vipArrivals.length} VIP${vipNames ? ` (${vipNames})` : ""}, and ${facts.departures} departures today.`;
}

function taskPhrase(task: OpsTask, lang: Lang) {
  const where = [rankWord(task.rank, lang), task.department, task.assignee].filter(Boolean).join(", ");
  return `${task.title} (${where})`;
}

function openItems(facts: OpsFacts, lang: Lang) {
  const tasks = priorityTasks(facts).slice(0, 4).map((task) => taskPhrase(task, lang));
  const extras = facts.openExtraJobs.slice(0, 4).map((job) => job.assignee ? `${job.title} (${job.assignee})` : job.title);
  const items = [...tasks, ...extras];
  if (!items.length) return lang === "de" ? "Keine." : lang === "it" ? "Nessuno." : "None.";
  return `${items.join("; ")}.`;
}

export function dashboardBodies(facts: OpsFacts): BriefingBodies {
  const build = (lang: Lang) => [arrivalSentence(facts, lang), expressClause(facts, lang), noServiceClause(facts, lang), staffSentences(facts, lang)]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return { bodyEn: build("en"), bodyDe: build("de"), bodyIt: build("it") };
}

export function handoverBodies(facts: OpsFacts): BriefingBodies {
  const build = (lang: Lang) => {
    const labels = HANDOVER_LABELS[lang];
    const express = expressClause(facts, lang) || (lang === "de" ? "Keine Express-Zimmer." : lang === "it" ? "Nessuna camera express." : "No express rooms.");
    const staff = staffSentences(facts, lang) || (lang === "de" ? "Keine Abwesenheiten heute oder morgen." : lang === "it" ? "Nessuna assenza oggi o domani." : "No absences today or tomorrow.");
    const occupancy = lang === "de" ? `Auslastung ${facts.occupancy}%.` : lang === "it" ? `Occupazione ${facts.occupancy}%.` : `Occupancy ${facts.occupancy}%.`;
    const noService = noServiceClause(facts, lang);
    return [
      `${labels.focus} ${arrivalSentence(facts, lang)} ${express} ${noService} ${occupancy}`.replace(/\s+/g, " ").trim(),
      `${labels.open} ${openItems(facts, lang)}`,
      `${labels.staff} ${staff}`,
    ].join("\n\n").slice(0, 1400);
  };
  return { bodyEn: build("en"), bodyDe: build("de"), bodyIt: build("it") };
}

export function taskBodies(facts: OpsFacts): BriefingBodies {
  const build = (lang: Lang) => {
    const ranked = priorityTasks(facts);
    const total = facts.openTasks.length;
    let lead = "";
    if (!ranked.length) {
      lead = lang === "de" ? "Keine offenen Aufgaben." : lang === "it" ? "Nessun compito aperto." : "No open tasks.";
    } else {
      const first = ranked.slice(0, 5).map((task) => taskPhrase(task, lang)).join("; ");
      lead = lang === "de"
        ? `Von ${total} offenen Aufgaben zuerst: ${first}.`
        : lang === "it"
          ? `Su ${total} compiti aperti, prima questi: ${first}.`
          : `From ${total} open tasks, do these first: ${first}.`;
    }
    return [lead, expressClause(facts, lang), staffSentences(facts, lang)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 700);
  };
  return { bodyEn: build("en"), bodyDe: build("de"), bodyIt: build("it") };
}

export function bodiesForPlace(place: "DASHBOARD" | "HANDOVERS" | "TASKS", facts: OpsFacts) {
  if (place === "DASHBOARD") return dashboardBodies(facts);
  if (place === "HANDOVERS") return handoverBodies(facts);
  return taskBodies(facts);
}
