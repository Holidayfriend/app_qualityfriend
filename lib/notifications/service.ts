import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export type NotificationText = Record<"en" | "de" | "it", { title: string; body: string }>;
export type NotificationInput = {
  hotelTenantId: string; recipientId: string; moduleKey: string; eventKey: string;
  icon: string; destination: string; text: NotificationText;
  requiredScope?: "OWN" | "ALL";
};

// Trusted server/worker code only. Call inside the transaction completing the work.
export async function createNotification(client: PoolClient, data: NotificationInput) {
  if (!/^\/[a-z0-9][a-z0-9/_-]*$/i.test(data.destination)) throw new Error("Invalid notification destination");
  for (const language of ["en", "de", "it"] as const) {
    if (!data.text[language]?.title || !data.text[language]?.body) throw new Error("All notification translations are required");
  }
  await client.query(`INSERT INTO notifications
    (id,hotel_tenant_id,recipient_id,module_key,event_key,icon,destination,title_en,title_de,title_it,body_en,body_de,body_it,required_scope)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::"PermissionScope")
    ON CONFLICT (hotel_tenant_id,recipient_id,event_key) DO NOTHING`,
  [randomUUID(), data.hotelTenantId, data.recipientId, data.moduleKey, data.eventKey, data.icon, data.destination,
    data.text.en.title, data.text.de.title, data.text.it.title, data.text.en.body, data.text.de.body, data.text.it.body, data.requiredScope ?? "OWN"]);
}
