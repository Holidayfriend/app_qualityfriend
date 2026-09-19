export type RepairStatus = "neu" | "uebernommen" | "in_arbeit" | "wartet" | "erledigt" | "draft";
export type RepairVisibility = "alle" | "dept";
export type RepairDept = "reception" | "housekeeping" | "restaurant" | "kitchen" | "maintenance" | "seaspa" | "administration";
export type RepairFile = { id?: string; name: string; type: "photo" | "video" | "voice"; url?: string };
export type RepairComment = { text: string; author: string; date: string };

export type Repair = {
  id: string;
  title: string;
  location: string;
  creator: string;
  date: string;
  status: RepairStatus;
  assignee: string;
  visibility: RepairVisibility;
  depts: string[];
  tags: string[];
  desc: string;
  attachments: RepairFile[];
  comments: RepairComment[];
};

export type RepairTemplate = { id: string; title: string; desc: string; visibility: RepairVisibility; depts: string[] };

export const REPAIR_ASSIGNEES = ["Klaus Pichler", "Thomas Gruber", "Maria Rieder", "Sabine Moser", "Luca Bianchi"];
export const REPAIR_AREA_KEYS = ["hall-2", "boiler", "basement", "garden", "restaurant", "spa"] as const;
export type RepairAreaKey = (typeof REPAIR_AREA_KEYS)[number];
export const REPAIR_DEPTS: RepairDept[] = ["reception", "housekeeping", "restaurant", "kitchen", "maintenance", "seaspa", "administration"];
export const STATUS_CHIP: Record<RepairStatus, string> = {
  neu: "chip-b",
  uebernommen: "chip-p",
  in_arbeit: "chip-a",
  wartet: "chip-n",
  erledigt: "chip-g",
  draft: "chip-a",
};

export const repairTemplates: RepairTemplate[] = [
  { id: "hk-admin", title: "Standard Reparatur – ", desc: "Wo (Zimmer/Bereich):\nWas ist das Problem:\n", visibility: "dept", depts: ["administration"] },
  { id: "technik", title: "Technik-Notfall – ", desc: "Wo (Zimmer/Bereich):\nWas ist das Problem:\nDringlichkeit: Sofort\n", visibility: "alle", depts: [] },
];

export const seedRepairs: Repair[] = [
  { id: "hydrauliker", title: "Hydrauliker", location: "boiler", creator: "Klaus", date: "26.01.2025", status: "neu", assignee: "", visibility: "alle", depts: [], tags: [], desc: "Anschlüsse Verbundanlage 5/4 Zoll Heizraum, Verteilerraum\nPumpe abschließen Pumpensumpf\nRückschlagventil wie von Laimer", attachments: [], comments: [] },
  { id: "heizung48", title: "Heizung schwächelt – Zimmer 48", location: "48", creator: "Klaus", date: "18.08.2026", status: "in_arbeit", assignee: "Thomas Gruber", visibility: "dept", depts: ["maintenance"], tags: ["Dringend"], desc: "Gast beschwert sich seit gestern über schwache Heizleistung. Bitte heute noch prüfen.", attachments: [{ name: "Foto_Heizung_48.jpg", type: "photo" }], comments: [] },
  { id: "fenster55", title: "Fenstergriff lose – Zimmer 55", location: "55", creator: "Klaus", date: "17.08.2026", status: "wartet", assignee: "Thomas Gruber", visibility: "dept", depts: ["maintenance"], tags: [], desc: "Fenstergriff im Bad wackelt, könnte abbrechen.", attachments: [], comments: [{ text: "Ersatzteil bestellt, kommt Freitag.", author: "Thomas Gruber", date: "17.08.2026" }] },
  { id: "standard1", title: "Standard Reparatur/Riparazione", location: "61", creator: "Reception", date: "04.12.2023", status: "erledigt", assignee: "Thomas Gruber", visibility: "dept", depts: ["administration", "reception"], tags: ["Standard Reparatur"], desc: "Wo (Zimmer): 61\nWas: Lampe Nachttisch defekt", attachments: [], comments: [] },
  { id: "lampe", title: "Lampe Flur Etage 2 ausgetauscht", location: "hall-2", creator: "Thomas Gruber", date: "17.08.2026", status: "erledigt", assignee: "Thomas Gruber", visibility: "alle", depts: [], tags: [], desc: "Erledigt – neue LED-Lampe eingesetzt.", attachments: [], comments: [] },
];
