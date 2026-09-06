export type FileStatus = "current" | "review" | "outdated";
export type PreviewFile = { id: string; name: string; updated: string; status: FileStatus };
export const knowledgeBaseMeta = {
  hotel: { icon: "📚", storeId: "hotel-cmi9pn8xc-default", scope: "hotelWide", files: [["Mitarbeiterhandbuch.pdf", "01.08.2026", "current"], ["Notfallkontakte & Krisenhandbuch.pdf", "01.08.2026", "current"], ["Brandschutz & Evakuierungsplan.pdf", "10.01.2026", "review"]] },
  reception: { icon: "🏨", storeId: "dept-reception-store", scope: "department", files: [["Check-in & Check-out Ablauf.pdf", "01.08.2026", "current"], ["Kassenabschluss & Tagesabrechnung.pdf", "01.03.2026", "outdated"]] },
  housekeeping: { icon: "🧹", storeId: "dept-housekeeping-store", scope: "department", files: [["Reinigungsstandards & Checklisten.pdf", "15.07.2026", "current"], ["Wäschelogistik.pdf", "20.02.2026", "current"]] },
  restaurant: { icon: "🍽️", storeId: "dept-restaurant-store", scope: "department", files: [["Allergen-Management & Speisekarte.pdf", "20.06.2026", "current"]] },
  kitchen: { icon: "👨‍🍳", storeId: "dept-kitchen-store", scope: "department", files: [["HACCP & Hygienevorschriften.pdf", "05.05.2026", "review"]] },
  administration: { icon: "👤", storeId: "dept-administration-store", scope: "department", files: [["Onboarding neuer Mitarbeiter.pdf", "05.05.2026", "review"]] },
  marketing: { icon: "📣", storeId: "dept-marketing-store", scope: "department", files: [["SEO-Keywords-2026.pdf", "23.01.2026", "current"], ["Markenrichtlinien.pdf", "10.01.2026", "current"]] },
} as const;
export type KnowledgeBaseKey = keyof typeof knowledgeBaseMeta;
export function isKnowledgeBaseKey(value: string): value is KnowledgeBaseKey { return value in knowledgeBaseMeta; }
export function previewFiles(key: KnowledgeBaseKey): PreviewFile[] { return knowledgeBaseMeta[key].files.map(([name, updated, status], index) => ({ id: `${key}-${index}`, name, updated, status })); }
