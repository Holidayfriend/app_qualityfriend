export type NoteDept = string;
export type NoteVisibility = "alle" | "dept" | "user" | "privat";
export type NoteStatus = "aktiv" | "inaktiv";
export type NoteComment = { text: string; author: string; date: string };
export type NoteFile = { name: string };
export type Note = {
  id: string;
  title: string;
  creator: string;
  date: string;
  status: NoteStatus;
  visibility: NoteVisibility;
  depts: NoteDept[];
  userIds: string[];
  tags: string[];
  origLang: "de" | "en" | "it";
  desc: string;
  attachments: NoteFile[];
  comments: NoteComment[];
};

export const NOTE_COLORS: Record<string, string> = {
  reception: "#DBEAFE",
  housekeeping: "#DCFCE7",
  restaurant: "#FEF3C7",
  kitchen: "#FEE2E2",
  maintenance: "#F5E8CC",
  seaspa: "#EDE9FE",
  administration: "#E5E7EB",
  alle: "#FEF9E7",
  privat: "#F3F4F6",
  user: "#E0F2FE",
};

export const DEPT_IDS = ["reception", "housekeeping", "restaurant", "kitchen", "maintenance", "seaspa", "administration"] as const;

export function noteColorFor(note: Note) {
  if (note.visibility === "dept" && note.depts[0]) return NOTE_COLORS[note.depts[0]] || "#F3F4F6";
  if (note.visibility === "user") return NOTE_COLORS.user;
  if (note.visibility === "privat") return NOTE_COLORS.privat;
  return NOTE_COLORS.alle;
}

export const INITIAL_NOTES: Note[] = [
  { id: "vip44", title: "Gast Wünsche VIP Zi. 44", creator: "Klaus", date: "19.08.2026", status: "aktiv", visibility: "dept", depts: ["restaurant", "reception"], userIds: [], tags: ["VIP"], origLang: "de", desc: "Hr. Brunner – allergisch gegen Nüsse. Kein Nussnougataufstrich. Immer Fensterplatz im Restaurant. Bevorzugt stilles Wasser.", attachments: [], comments: [] },
  { id: "lieferanten", title: "Lieferanten Kontakte", creator: "Klaus", date: "15.08.2026", status: "aktiv", visibility: "dept", depts: ["kitchen"], userIds: [], tags: [], origLang: "de", desc: "Bäckerei Mayr: 0471-123456\nFleischer Hofer: 0471-654321\nBio-Gemüse Schwingshackl: Dienstag & Freitag", attachments: [], comments: [] },
  { id: "renovierung", title: "Renovierung Etage 2 – Herbst", creator: "Klaus", date: "10.08.2026", status: "aktiv", visibility: "alle", depts: [], userIds: [], tags: ["Projekt"], origLang: "de", desc: "Zimmer 55–61 im November. Angebote: Maler Gruber 8.400€, Tischler Pichler 4.200€. Termin: 3.–21. Nov. Gäste umbuchen!", attachments: [{ name: "Angebot_Gruber.pdf" }], comments: [] },
  { id: "marketing", title: "Marketingidee Winter", creator: "Klaus", date: "05.08.2026", status: "aktiv", visibility: "privat", depts: [], userIds: [], tags: ["Marketing"], origLang: "de", desc: "Winterpaket \"Schneeflocke\": 3 Nächte + Skikurs + Fondue-Abend. Preis ca. 480€/Person. Buchbar ab Oktober.", attachments: [], comments: [] },
  { id: "steuerberater", title: "Steuerberater Termin", creator: "Klaus", date: "01.08.2026", status: "aktiv", visibility: "dept", depts: ["administration"], userIds: [], tags: [], origLang: "de", desc: "Dr. Mair Kanzlei · 02.09.2026, 10:00 Uhr · Jahresabschluss 2025 + Q2 2026 · Unterlagen bis 28.08 vorbereiten", attachments: [], comments: [] },
  { id: "wasserleitung", title: "Problem Wasserleitung Keller", creator: "Thomas Gruber", date: "18.08.2026", status: "aktiv", visibility: "dept", depts: ["maintenance"], userIds: [], tags: ["Reparatur"], origLang: "de", desc: "Leichtes Tropfen bei Heizungsrohr. Installateur Muster kommt Fr. 22.08. Eimer aufgestellt.", attachments: [], comments: [] },
  { id: "searchconsole", title: "Search Console – Anleitung", creator: "Klaus", date: "23.01.2026", status: "aktiv", visibility: "dept", depts: ["administration"], userIds: [], tags: ["SEO"], origLang: "de", desc: "https://search.google.com/search-console\n\nImmer Klicks und durchschnittliche Position auswählen, dann sieht man die Veränderung.\nSuchanfragen ohne \"Weih\" filtern, um echte Suchbegriffe zu sehen.\nSemrush-Gratisaccount nutzen, um zu sehen was Seiten hergeben.", attachments: [{ name: "Screenshot_SearchConsole.png" }], comments: [] },
];
