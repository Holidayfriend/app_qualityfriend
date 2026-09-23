import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "../../app/generated/prisma/client";

type Tx = Prisma.TransactionClient;

async function schedulePlannerIds(tx: Tx, hotelTenantId: string) {
  const [users, permissions] = await Promise.all([
    tx.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false },
      select: { id: true, role: true },
    }),
    tx.roleModulePermission.findMany({
      where: { hotelTenantId, moduleKey: "schedule" },
      select: { role: true, canView: true },
    }),
  ]);
  const extra = new Map(permissions.map((row) => [row.role, row.canView]));
  return users.filter((user) => {
    if (user.role === "ADMIN") return true;
    const override = extra.get(user.role);
    if (override === true) return true;
    if (override === false) return false;
    return user.role === "TEAM_LEAD" || user.role === "MANAGEMENT";
  }).map((user) => user.id);
}

async function notify(tx: Tx, input: {
  hotelTenantId: string;
  recipientIds: string[];
  eventKey: string;
  destination: string;
  text: Record<"en" | "de" | "it", { title: string; body: string }>;
}) {
  const ids = [...new Set(input.recipientIds)].filter(Boolean);
  if (!ids.length) return;
  await tx.notification.createMany({
    skipDuplicates: true,
    data: ids.map((recipientId) => ({
      hotelTenantId: input.hotelTenantId,
      recipientId,
      moduleKey: "schedule",
      eventKey: `${input.eventKey}:${recipientId}:${randomUUID()}`,
      icon: "schedule",
      destination: input.destination,
      titleEn: input.text.en.title,
      titleDe: input.text.de.title,
      titleIt: input.text.it.title,
      bodyEn: input.text.en.body,
      bodyDe: input.text.de.body,
      bodyIt: input.text.it.body,
      requiredScope: "OWN" as const,
    })),
  });
}

export async function notifyLeaveRequested(tx: Tx, hotelTenantId: string, requesterId: string, employeeName: string, swap: boolean) {
  const planners = (await schedulePlannerIds(tx, hotelTenantId)).filter((id) => id !== requesterId);
  const kindEn = swap ? "shift swap" : "time off";
  const kindDe = swap ? "Schichttausch" : "Freistellung";
  const kindIt = swap ? "scambio turno" : "permesso";
  await notify(tx, {
    hotelTenantId,
    recipientIds: planners,
    eventKey: `schedule:request:${randomUUID()}`,
    destination: swap ? "/schedule/swaps" : "/schedule/absences",
    text: {
      en: { title: swap ? "New shift swap request" : "New time-off request", body: `${employeeName} requested ${kindEn}.` },
      de: { title: swap ? "Neue Tauschanfrage" : "Neue Freistellungsanfrage", body: `${employeeName} hat ${kindDe} beantragt.` },
      it: { title: swap ? "Nuova richiesta di scambio" : "Nuova richiesta di permesso", body: `${employeeName} ha richiesto ${kindIt}.` },
    },
  });
}

export async function notifyLeaveDecided(tx: Tx, hotelTenantId: string, employeeId: string, actorId: string, approved: boolean, swap: boolean) {
  if (employeeId === actorId) return;
  const dest = swap ? "/schedule/swaps" : "/schedule/absences";
  await notify(tx, {
    hotelTenantId,
    recipientIds: [employeeId],
    eventKey: `schedule:decision:${randomUUID()}`,
    destination: dest,
    text: approved
      ? {
        en: { title: swap ? "Shift swap approved" : "Time off approved", body: "Your request was approved." },
        de: { title: swap ? "Schichttausch genehmigt" : "Freistellung genehmigt", body: "Deine Anfrage wurde genehmigt." },
        it: { title: swap ? "Scambio turno approvato" : "Permesso approvato", body: "La tua richiesta è stata approvata." },
      }
      : {
        en: { title: swap ? "Shift swap rejected" : "Time off rejected", body: "Your request was rejected." },
        de: { title: swap ? "Schichttausch abgelehnt" : "Freistellung abgelehnt", body: "Deine Anfrage wurde abgelehnt." },
        it: { title: swap ? "Scambio turno rifiutato" : "Permesso rifiutato", body: "La tua richiesta è stata rifiutata." },
      },
  });
}

export async function notifySchedulePublished(tx: Tx, hotelTenantId: string, recipientIds: string[], actorId: string) {
  await notify(tx, {
    hotelTenantId,
    recipientIds: recipientIds.filter((id) => id !== actorId),
    eventKey: `schedule:publish:${randomUUID()}`,
    destination: "/schedule/own",
    text: {
      en: { title: "Schedule published", body: "Your schedule was updated. Open My plan to see it." },
      de: { title: "Dienstplan veröffentlicht", body: "Dein Dienstplan wurde aktualisiert. Öffne Mein Plan." },
      it: { title: "Turni pubblicati", body: "Il tuo piano turni è stato aggiornato. Apri La mia settimana." },
    },
  });
}
