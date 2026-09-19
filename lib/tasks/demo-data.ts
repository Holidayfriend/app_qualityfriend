export type HotelDept = { id: string; name: string };
export type HotelUser = { id: string; name: string };
export type PublicTask = {
  id: string;
  title: string;
  note: string;
  status: "open" | "done";
  assignType: "dept" | "person";
  assignee: string;
  assigneeId: string;
  departmentId: string;
  due: string;
  dueIso: string;
  origin: string;
  creator: string;
};
export type PublicChecklistItem = { id: string; text: string; state: "open" | "done" | "exception"; comment: string };
export type PublicChecklist = {
  id: string;
  kind: "checklist" | "template";
  title: string;
  desc: string;
  status: "active" | "draft" | "archived";
  assignType: "all" | "dept" | "person";
  assignee: string;
  assigneeId: string;
  departmentId: string;
  dueType: "once" | "recurring";
  recurrence: "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  weekdays: string[];
  dueIso: string;
  startIso: string;
  endIso: string;
  nextDue: string;
  nextDueIso: string;
  items: PublicChecklistItem[];
  progress: string;
  completions: { id: string; result: string; author: string; date: string }[];
};

const today = () => new Date().toISOString().slice(0, 10);
function iso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const demoDepartments = [
  { id: "d-rec", name: { en: "Reception", de: "Rezeption", it: "Reception" } },
  { id: "d-hk", name: { en: "Housekeeping", de: "Housekeeping", it: "Housekeeping" } },
  { id: "d-rest", name: { en: "Restaurant", de: "Restaurant", it: "Ristorante" } },
  { id: "d-admin", name: { en: "Administration", de: "Verwaltung", it: "Amministrazione" } },
  { id: "d-kit", name: { en: "Kitchen", de: "Küche", it: "Cucina" } },
  { id: "d-tech", name: { en: "Maintenance", de: "Technik", it: "Manutenzione" } },
  { id: "d-sec", name: { en: "Security", de: "Sicherheit", it: "Sicurezza" } },
];

export const demoUsers = [
  { id: "u-klaus", name: "Klaus Pichler" },
  { id: "u-maria", name: "Maria Rieder" },
  { id: "u-sabine", name: "Sabine Moser" },
  { id: "u-thomas", name: "Thomas Gruber" },
  { id: "u-nina", name: "Nina Gasser" },
  { id: "u-manuela", name: "Manuela" },
];

type L = { en: string; de: string; it: string };

const copy: Record<string, L> = {
  t1: { en: "Express cleaning rooms 45 & 51 by 14:00", de: "Express-Reinigung Zi. 45 & 51 bis 14:00", it: "Pulizia express camere 45 e 51 entro le 14:00" },
  t2: { en: "Reply to TripAdvisor review Fam. Wagner", de: "TripAdvisor Rezension Fam. Wagner beantworten", it: "Rispondere alla recensione TripAdvisor Fam. Wagner" },
  t3: { en: "Clarify breakfast cover for Zorah tomorrow", de: "Frühstücksvertretung für Zorah morgen klären", it: "Chiarire la copertura colazione per Zorah domani" },
  t4: { en: "Check milk stock & reorder", de: "Lager Milch prüfen & nachbestellen", it: "Controllare scorta latte e riordinare" },
  t5: { en: "Confirm heating repair room 48 – tradesperson", de: "Reparatur Heizung Zi. 48 – Handwerker bestätigen", it: "Confermare riparazione riscaldamento camera 48" },
  t6: { en: "Emergency exits floor 2 – weekly check", de: "Notausgänge Etage 2 – Wochenkontrolle", it: "Uscite di emergenza piano 2 – controllo settimanale" },
  t7: { en: "First-aid kit floor 1 checked", de: "Erste-Hilfe-Koffer Etage 1 kontrolliert", it: "Cassetta di pronto soccorso piano 1 controllata" },
  c1: { en: "First-aid kit floor 1", de: "Erste-Hilfe-Koffer Etage 1", it: "Cassetta di pronto soccorso piano 1" },
  c2: { en: "Main switch emergency stop", de: "Notschalter Hauptverteiler", it: "Pulsante di emergenza quadro principale" },
  c3: { en: "Fire extinguishers floors 1 & 2", de: "Feuerlöscher Etage 1 & 2", it: "Estintori piani 1 e 2" },
  c4: { en: "Emergency exits entire house", de: "Notausgänge gesamtes Haus", it: "Uscite di emergenza di tutto l’edificio" },
  tpl1: { en: "Weekly safety check", de: "Wochenkontrolle Sicherheit", it: "Controllo settimanale sicurezza" },
  tpl2: { en: "Seasonal deep clean", de: "Saisonale Tiefenreinigung", it: "Pulizia straordinaria stagionale" },
  tpl3: { en: "Christmas preparations", de: "Weihnachtsvorbereitungen", it: "Preparativi di Natale" },
};

function pick(value: L, locale: string) {
  return locale === "de" ? value.de : locale === "it" ? value.it : value.en;
}

export function seedTasks(locale: string): PublicTask[] {
  const due = (days: number) => {
    const value = iso(days);
    return { dueIso: value, due: value };
  };
  return [
    { id: "task-1", title: pick(copy.t1, locale), note: "", status: "open", assignType: "dept", assignee: pick(demoDepartments[1].name, locale), assigneeId: "", departmentId: "d-hk", ...due(0), origin: "", creator: "Maria Rieder" },
    { id: "task-2", title: pick(copy.t2, locale), note: "", status: "open", assignType: "dept", assignee: pick(demoDepartments[3].name, locale), assigneeId: "", departmentId: "d-admin", ...due(0), origin: "", creator: "Klaus Pichler" },
    { id: "task-3", title: pick(copy.t3, locale), note: "", status: "open", assignType: "dept", assignee: pick(demoDepartments[2].name, locale), assigneeId: "", departmentId: "d-rest", ...due(0), origin: "", creator: "Sabine Moser" },
    { id: "task-4", title: pick(copy.t4, locale), note: "", status: "open", assignType: "dept", assignee: pick(demoDepartments[4].name, locale), assigneeId: "", departmentId: "d-kit", ...due(1), origin: "", creator: "Nina Gasser" },
    { id: "task-5", title: pick(copy.t5, locale), note: "", status: "open", assignType: "dept", assignee: pick(demoDepartments[5].name, locale), assigneeId: "", departmentId: "d-tech", ...due(1), origin: "", creator: "Thomas Gruber" },
    { id: "task-6", title: pick(copy.t6, locale), note: "", status: "open", assignType: "dept", assignee: pick(demoDepartments[6].name, locale), assigneeId: "", departmentId: "d-sec", ...due(3), origin: "", creator: "Klaus Pichler" },
    { id: "task-7", title: pick(copy.t7, locale), note: "", status: "done", assignType: "dept", assignee: pick(demoDepartments[6].name, locale), assigneeId: "", departmentId: "d-sec", ...due(-1), origin: "", creator: "Maria Rieder" },
  ];
}

export function seedChecklists(locale: string): PublicChecklist[] {
  const wd = (days: number) => iso(days);
  const item = (id: string, text: L, state: "open" | "done" | "exception" = "open") => ({ id, text: pick(text, locale), state, comment: "" });
  return [
    {
      id: "cl-1", kind: "checklist", title: pick(copy.c1, locale), desc: "", status: "active", assignType: "dept",
      assignee: pick(demoDepartments[6].name, locale), assigneeId: "", departmentId: "d-sec", dueType: "recurring", recurrence: "weekly",
      weekdays: ["mo"], dueIso: "", startIso: today(), endIso: "", nextDue: wd(-2), nextDueIso: wd(-2),
      items: [item("i-1a", copy.c1, "done")], progress: "1/1",
      completions: [{ id: "h1", result: "done", author: "Maria Rieder", date: wd(-2) }],
    },
    {
      id: "cl-2", kind: "checklist", title: pick(copy.c2, locale), desc: "", status: "active", assignType: "dept",
      assignee: pick(demoDepartments[5].name, locale), assigneeId: "", departmentId: "d-tech", dueType: "recurring", recurrence: "weekly",
      weekdays: ["we"], dueIso: "", startIso: today(), endIso: "", nextDue: wd(2), nextDueIso: wd(2),
      items: [item("i-2a", copy.c2)], progress: "0/1", completions: [],
    },
    {
      id: "cl-3", kind: "checklist", title: pick(copy.c3, locale), desc: "", status: "active", assignType: "dept",
      assignee: pick(demoDepartments[6].name, locale), assigneeId: "", departmentId: "d-sec", dueType: "recurring", recurrence: "weekly",
      weekdays: ["fr"], dueIso: "", startIso: today(), endIso: "", nextDue: wd(4), nextDueIso: wd(4),
      items: [item("i-3a", copy.c3)], progress: "0/1", completions: [],
    },
    {
      id: "cl-4", kind: "checklist", title: pick(copy.c4, locale), desc: "", status: "active", assignType: "all",
      assignee: "", assigneeId: "", departmentId: "", dueType: "recurring", recurrence: "weekly",
      weekdays: ["sa"], dueIso: "", startIso: today(), endIso: "", nextDue: wd(5), nextDueIso: wd(5),
      items: [item("i-4a", copy.c4)], progress: "0/1", completions: [],
    },
  ];
}

export function seedTemplates(locale: string): PublicChecklist[] {
  const item = (id: string, text: string) => ({ id, text, state: "open" as const, comment: "" });
  return [
    { id: "tpl-1", kind: "template", title: copy.tpl1[locale as keyof L] ?? copy.tpl1.en, desc: "", status: "active", assignType: "all", assignee: "", assigneeId: "", departmentId: "", dueType: "recurring", recurrence: "weekly", weekdays: ["mo"], dueIso: "", startIso: "", endIso: "", nextDue: "", nextDueIso: "", items: [item("t1a", copy.c1[locale as keyof L] ?? copy.c1.en), item("t1b", copy.c3[locale as keyof L] ?? copy.c3.en), item("t1c", copy.c4[locale as keyof L] ?? copy.c4.en)], progress: "0/3", completions: [] },
    { id: "tpl-2", kind: "template", title: copy.tpl2[locale as keyof L] ?? copy.tpl2.en, desc: "", status: "active", assignType: "dept", assignee: "", assigneeId: "", departmentId: "d-hk", dueType: "once", recurrence: "once", weekdays: [], dueIso: "", startIso: "", endIso: "", nextDue: "", nextDueIso: "", items: [item("t2a", copy.tpl2[locale as keyof L] ?? copy.tpl2.en)], progress: "0/1", completions: [] },
    { id: "tpl-3", kind: "template", title: copy.tpl3[locale as keyof L] ?? copy.tpl3.en, desc: "", status: "active", assignType: "all", assignee: "", assigneeId: "", departmentId: "", dueType: "once", recurrence: "once", weekdays: [], dueIso: "", startIso: "", endIso: "", nextDue: "", nextDueIso: "", items: [item("t3a", copy.tpl3[locale as keyof L] ?? copy.tpl3.en)], progress: "0/1", completions: [] },
  ];
}
