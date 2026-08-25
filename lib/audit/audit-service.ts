import "server-only";

import type { PoolClient } from "pg";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";

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
  if (typeof direct === "string") return direct;
  if (typeof data.hotelName === "string") return data.hotelName;
  if (typeof data.email === "string") return data.email;
  const fullName = [data.firstName, data.lastName].filter((part) => typeof part === "string").join(" ");
  return fullName;
}

function descriptions(actor: string, entry: AuditEntry) {
  const changes = entry.changes && typeof entry.changes === "object" ? entry.changes as Record<string, unknown> : {};
  const entityNames = {
    en: { DEPARTMENT: "department", TEAM: "team", HOTEL: "hotel", USER: "user" },
    de: { DEPARTMENT: "Abteilung", TEAM: "Team", HOTEL: "Hotel", USER: "Benutzer" },
    it: { DEPARTMENT: "reparto", TEAM: "team", HOTEL: "hotel", USER: "utente" },
  } as const;
  const result = {} as Record<Locale, string>;
  for (const locale of ["en", "de", "it"] as const) {
    const entity = entityNames[locale][entry.entityType as keyof typeof entityNames.en] ?? entry.entityType.toLowerCase();
    const before = localizedName(changes.before, locale);
    const after = localizedName(changes.after, locale);
    if (entry.action === "CREATE") result[locale] = locale === "de" ? `${actor} hat ${entity} „${after}“ erstellt` : locale === "it" ? `${actor} ha creato ${entity} “${after}”` : `${actor} created new ${entity} “${after}”`;
    else if (entry.action === "UPDATE") result[locale] = locale === "de" ? `${actor} hat ${entity} von „${before}“ zu „${after}“ aktualisiert` : locale === "it" ? `${actor} ha aggiornato ${entity} da “${before}” a “${after}”` : `${actor} updated ${entity} “${after}” from “${before}”`;
    else if (entry.action === "DELETE") result[locale] = locale === "de" ? `${actor} hat ${entity} „${before}“ gelöscht` : locale === "it" ? `${actor} ha eliminato ${entity} “${before}”` : `${actor} deleted ${entity} “${before}”`;
    else result[locale] = locale === "de" ? `${actor} hat den Status von ${entity} „${after || before}“ geändert` : locale === "it" ? `${actor} ha cambiato lo stato di ${entity} “${after || before}”` : `${actor} changed the status of ${entity} “${after || before}”`;
  }
  return result;
}

export async function recordAuditLog(client: PoolClient, entry: AuditEntry) {
  const actorResult = await client.query<{ actor_name: string }>(`SELECT first_name || ' ' || last_name AS actor_name FROM users WHERE id = $1 LIMIT 1`, [entry.actorId]);
  const description = descriptions(actorResult.rows[0]?.actor_name ?? "User", entry);
  return client.query(
    `INSERT INTO audit_logs (hotel_tenant_id, actor_id, action, entity_type, entity_id, changes, description)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [entry.hotelTenantId, entry.actorId, entry.action, entry.entityType, entry.entityId ?? null, JSON.stringify(entry.changes ?? null), JSON.stringify(description)],
  );
}
