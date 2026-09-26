import "server-only";

import { prisma } from "../prisma";
import { completeHotelChat, HotelAiNotConfiguredError } from "../ai/complete";
import { pickLocalized } from "../recruiting/job-fields";
import type { ChatTurn } from "../manuals/chat";
import { scheduleViewer, type ScheduleActor } from "./access";
import { listAbsences } from "./leaves";
import { listWeekShifts, type PublicShift } from "./shifts";
import { addDaysIso, formatDayHeader, localTodayIso, mondayOfIso } from "./week";
import { shiftWorkHours } from "./hours";

type ChatLocale = "en" | "de" | "it";

const LANGUAGE: Record<ChatLocale, { name: string; rule: string }> = {
  en: { name: "English", rule: "The app language is English. Write the entire answer in English." },
  de: { name: "German", rule: "The app language is German. Write the entire answer in German (Deutsch)." },
  it: { name: "Italian", rule: "The app language is Italian. Write the entire answer in Italian (Italiano)." },
};

function parseLocale(value: unknown): ChatLocale {
  return value === "de" || value === "it" || value === "en" ? value : "en";
}

function shiftLine(row: PublicShift, names: Map<string, string>, locale: ChatLocale) {
  const who = names.get(row.userId) || row.userId;
  const kind = row.kind === "vac" ? "VACATION" : row.kind === "off" ? `OFF ${row.leaveCategory || ""} ${row.leaveDuration || ""}`.trim() : "WORK";
  const times = row.start && row.end ? `${row.start.slice(0, 5)}–${row.end.slice(0, 5)}` : "full day";
  const hours = row.kind === "work" ? ` ${shiftWorkHours({ kind: row.kind, start: row.start, end: row.end, breakMins: row.breakMins }).toFixed(1)}h` : "";
  const draft = row.draft ? " DRAFT" : "";
  const note = row.note ? ` note:${row.note.slice(0, 80)}` : "";
  return `${who} | ${row.date} ${formatDayHeader(row.date, locale)} | ${kind} ${times}${hours}${draft}${note}`;
}

async function schedulePack(actor: ScheduleActor, locale: ChatLocale) {
  const today = localTodayIso();
  const week0 = mondayOfIso(today);
  const weeks = [week0, addDaysIso(week0, 7), addDaysIso(week0, 14)];
  const [hotel, users, templates, absences, ...weekShifts] = await Promise.all([
    prisma.hotelTenant.findUnique({
      where: { id: actor.hotel_tenant_id },
      select: { hotelNameEn: true, hotelNameDe: true, hotelNameIt: true },
    }),
    prisma.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: { select: { nameEn: true, nameDe: true, nameIt: true, isDeleted: true } },
      },
    }),
    prisma.hotelShiftTemplate.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id },
      select: { name: true, nameDe: true, nameIt: true, startTime: true, endTime: true, breakMinutes: true },
      take: 20,
    }).catch(() => [] as { name: string; nameDe: string; nameIt: string; startTime: string; endTime: string; breakMinutes: number }[]),
    listAbsences(actor, locale),
    ...weeks.map((start) => listWeekShifts(actor, start, locale)),
  ]);
  const staff = actor.canManage ? users : users.filter((row) => row.id === actor.id);
  const names = new Map(staff.map((row) => [row.id, `${row.firstName} ${row.lastName}`.trim()]));
  const allowed = new Set(staff.map((row) => row.id));
  const shifts = weekShifts.flat().filter((row) => allowed.has(row.userId));
  const staffLines = staff.map((row) => {
    const dept = row.department && !row.department.isDeleted
      ? pickLocalized(row.department.nameEn, row.department.nameDe, row.department.nameIt, locale)
      : "no department";
    return `${row.firstName} ${row.lastName} · ${dept}`;
  }).join("\n") || "(no staff)";
  const shiftLines = shifts.map((row) => shiftLine(row, names, locale)).join("\n") || "(no shifts in the next 3 weeks)";
  const leaveLines = absences.filter((row) => actor.canManage || row.empKey === actor.id).slice(0, 40).map((row) => {
    const swap = row.category === "swap" && row.swapWith ? ` with ${row.swapWith}` : "";
    return `${row.status.toUpperCase()} ${row.category} ${row.employee}${swap} ${row.start}${row.end !== row.start ? `–${row.end}` : ""} ${row.duration} ${row.note ? `note:${row.note.slice(0, 60)}` : ""}`.trim();
  }).join("\n") || "(no leave or swap requests)";
  const templateLines = templates.map((row) => `${pickLocalized(row.name, row.nameDe, row.nameIt, locale)} ${row.startTime}–${row.endTime} break ${row.breakMinutes}m`).join("\n") || "(no templates)";
  const hotelName = hotel ? pickLocalized(hotel.hotelNameEn, hotel.hotelNameDe, hotel.hotelNameIt, locale) : "";
  const workHours = shifts.filter((row) => row.kind === "work").reduce((total, row) => total + shiftWorkHours({ kind: row.kind, start: row.start, end: row.end, breakMins: row.breakMins }), 0);
  return [
    "PACK TYPE: hotel roster facts from QualityFriend. Do not invent people, days, or hours.",
    `Hotel: ${hotelName || "(unnamed)"}`,
    `Today: ${today}. Weeks packed: ${weeks.join(", ")} (Mon starts). DRAFT = unpublished; staff do not see drafts until Publish.`,
    `Work hours in this pack: ${workHours.toFixed(1)}`,
    `Staff:\n${staffLines}`,
    `Shift templates:\n${templateLines}`,
    `Shifts (this week + next 2 weeks):\n${shiftLines}`,
    `Time off / vacation / swap requests:\n${leaveLines}`,
  ].join("\n\n").slice(0, 16000);
}

export async function scheduleContextPack(locale?: unknown) {
  const actor = await scheduleViewer();
  if (!actor) return null;
  return schedulePack(actor, parseLocale(locale));
}

export async function answerScheduleQuestion(question: string, history: ChatTurn[], locale?: unknown) {
  const query = question.trim().slice(0, 2000);
  if (!query) return { error: "EMPTY" as const };
  const chatLocale = parseLocale(locale);
  const language = LANGUAGE[chatLocale];
  const actor = await scheduleViewer();
  if (!actor) {
    const denied = {
      en: "You do not have access to Schedule, so this assistant cannot see shifts.",
      de: "Du hast keinen Zugriff auf den Dienstplan. Dieser Assistent sieht keine Schichten.",
      it: "Non hai accesso ai turni, quindi questo assistente non vede il piano.",
    };
    return { answer: denied[chatLocale] };
  }

  const pack = await schedulePack(actor, chatLocale);
  const prior = history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));
  try {
    const answer = await completeHotelChat(prisma, actor.hotel_tenant_id, [
      {
        role: "system",
        content: `${language.rule} Never switch language. You are the hotel schedule assistant. Use ONLY the roster pack. Suggest coverage, gaps, vacation clashes, and hour totals. Do not claim you changed the live plan. If a fact is missing, say you do not know. Prefer names and dates from the pack.`,
      },
      ...prior,
      { role: "user", content: `App language: ${language.name}. Reply only in ${language.name}.\n\nQuestion:\n${query}\n\nSchedule pack:\n${pack}` },
    ]);
    if (answer) return { answer };
    return {
      answer: chatLocale === "de"
        ? "Die KI-Antwort ist gerade nicht verfügbar. Ich erfinde keinen Dienstplan."
        : chatLocale === "it"
          ? "La risposta IA non è disponibile. Non invento i turni."
          : "The language model is unavailable. I will not invent roster facts.",
    };
  } catch (error) {
    if (error instanceof HotelAiNotConfiguredError) {
      return {
        answer: chatLocale === "de"
          ? "Hinterlege in den Einstellungen einen KI-Schlüssel, damit der Dienstplan-Assistent antworten kann."
          : chatLocale === "it"
            ? "In Impostazioni aggiungi una chiave IA perché l’assistente turni possa rispondere."
            : "Add an AI key in Settings so the schedule assistant can answer.",
      };
    }
    return { error: "MODEL_FAILED" as const };
  }
}
