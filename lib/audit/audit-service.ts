import "server-only";

import type { Prisma } from "../../app/generated/prisma/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "STATUS_CHANGE";

type AuditEntry = {
  hotelTenantId: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  changes?: unknown;
};

type Locale = "en" | "de" | "it";

function localizedName(value: unknown, locale: Locale) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const data = value as Record<string, unknown>;
  const direct = data[locale];
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof data.title === "string" && data.title.trim()) return data.title;
  if (typeof data.hotelName === "string") return data.hotelName;
  if (typeof data.email === "string") return data.email;
  const fullName = [data.firstName, data.lastName].filter((part) => typeof part === "string").join(" ");
  return fullName;
}

function descriptions(actor: string, entry: AuditEntry) {
  const changes = entry.changes && typeof entry.changes === "object" ? entry.changes as Record<string, unknown> : {};
  const entityNames = {
    en: { DEPARTMENT: "department", TEAM: "team", HOTEL: "hotel", USER: "user", EXTRA_JOB: "extra job", FLOOR: "floor", ROOM_CATEGORY: "room category", ROOM: "room", RECRUITING_JOB: "job listing", RECRUITING_APPLICATION: "application" },
    de: { DEPARTMENT: "Abteilung", TEAM: "Team", HOTEL: "Hotel", USER: "Benutzer", EXTRA_JOB: "Zusatzaufgabe", FLOOR: "Etage", ROOM_CATEGORY: "Zimmerkategorie", ROOM: "Zimmer", RECRUITING_JOB: "Stellenanzeige", RECRUITING_APPLICATION: "Bewerbung" },
    it: { DEPARTMENT: "reparto", TEAM: "team", HOTEL: "hotel", USER: "utente", EXTRA_JOB: "lavoro aggiuntivo", FLOOR: "piano", ROOM_CATEGORY: "categoria camera", ROOM: "camera", RECRUITING_JOB: "annuncio di lavoro", RECRUITING_APPLICATION: "candidatura" },
  } as const;
  const result = {} as Record<Locale, string>;
  for (const locale of ["en", "de", "it"] as const) {
    const entity = entityNames[locale][entry.entityType as keyof typeof entityNames.en] ?? entry.entityType.toLowerCase();
    const label = (value: unknown) => {
      if (entry.entityType !== "EXTRA_JOB" || !value || typeof value !== "object") return localizedName(value, locale);
      const snapshot = value as Record<string, unknown>;
      const editedLocale = changes.locale === "de" || changes.locale === "it" ? changes.locale : "en";
      const name = localizedName(value, locale) || localizedName(value, editedLocale);
      return `${name} (${snapshot.minutes} min)`;
    };
    const before = label(changes.before);
    const after = label(changes.after);
    if (entry.action === "CREATE") result[locale] = locale === "de" ? `${actor} hat ${entity} „${after}“ erstellt` : locale === "it" ? `${actor} ha creato ${entity} “${after}”` : `${actor} created new ${entity} “${after}”`;
    else if (entry.action === "UPDATE") result[locale] = locale === "de" ? `${actor} hat ${entity} von „${before}“ zu „${after}“ aktualisiert` : locale === "it" ? `${actor} ha aggiornato ${entity} da “${before}” a “${after}”` : `${actor} updated ${entity} “${after}” from “${before}”`;
    else if (entry.action === "DELETE") result[locale] = locale === "de" ? `${actor} hat ${entity} „${before}“ gelöscht` : locale === "it" ? `${actor} ha eliminato ${entity} “${before}”` : `${actor} deleted ${entity} “${before}”`;
    else if (entry.action === "RESTORE") result[locale] = locale === "de" ? `${actor} hat ${entity} „${after}“ wiederhergestellt` : locale === "it" ? `${actor} ha ripristinato ${entity} “${after}”` : `${actor} restored ${entity} “${after}”`;
    else result[locale] = locale === "de" ? `${actor} hat den Status von ${entity} „${after || before}“ geändert` : locale === "it" ? `${actor} ha cambiato lo stato di ${entity} “${after || before}”` : `${actor} changed the status of ${entity} “${after || before}”`;
  }
  return result;
}

export async function recordAuditLog(client: Prisma.TransactionClient, entry: AuditEntry) {
  const actor=await client.user.findUnique({where:{id:entry.actorId},select:{firstName:true,lastName:true}});
  const description=descriptions(actor?`${actor.firstName} ${actor.lastName}`:"User",entry);
  return client.auditLog.create({data:{hotelTenantId:entry.hotelTenantId,actorId:entry.actorId,action:entry.action,entityType:entry.entityType,entityId:entry.entityId??null,changes:(entry.changes??null) as Prisma.InputJsonValue,description:description as Prisma.InputJsonValue}});
}
