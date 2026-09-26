import "server-only";

import { currentAccessUser } from "../auth/module-access";
import { prisma } from "../prisma";
import { completeHotelChat, HotelAiNotConfiguredError } from "./complete";
import { visibleChecklistWhere } from "../checklists/service";
import { housekeepingAccess } from "../housekeeping/access";
import type { ChatTurn } from "../manuals/chat";
import { manualContextPack } from "../manuals/chat";
import { manualsViewer } from "../manuals/access";
import { recruitingActor } from "../recruiting/access";
import { pickLocalized } from "../recruiting/job-fields";
import { repairsViewer } from "../repairs/access";
import { visibleWhere } from "../repairs/service";
import { scheduleContextPack } from "../schedule/chat";
import { scheduleViewer } from "../schedule/access";
import { addDaysIso, isoFromUtc, localTodayIso, parseIsoDate } from "../schedule/week";
import { tasksViewer } from "../tasks/access";
import { visibleTaskWhere } from "../tasks/service";

type ChatLocale = "en" | "de" | "it";

const LANGUAGE: Record<ChatLocale, { name: string; rule: string }> = {
  en: { name: "English", rule: "The app language is English. Write the entire answer in English." },
  de: { name: "German", rule: "The app language is German. Write the entire answer in German (Deutsch)." },
  it: { name: "Italian", rule: "The app language is Italian. Write the entire answer in Italian (Italiano)." },
};

function parseLocale(value: unknown): ChatLocale {
  return value === "de" || value === "it" || value === "en" ? value : "en";
}

function textOf(en: string | null | undefined, de: string | null | undefined, it: string | null | undefined, locale: ChatLocale) {
  return pickLocalized(en || "", de || "", it || "", locale);
}

function checkItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function personName(row: { firstName: string; lastName: string } | null | undefined) {
  return row ? `${row.firstName} ${row.lastName}`.trim() : "";
}

async function recruitingPack(hotelTenantId: string, locale: ChatLocale) {
  const [jobs, applications] = await Promise.all([
    prisma.recruitingJob.findMany({
      where: { hotelTenantId, status: "ACTIVE" },
      take: 15,
      orderBy: { updatedAt: "desc" },
      select: {
        title: true, titleDe: true, titleIt: true, workType: true, location: true, clickCount: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.recruitingApplication.findMany({
      where: { hotelTenantId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        firstName: true, lastName: true, stage: true, aiScore: true, aiRecommendation: true,
        job: { select: { title: true, titleDe: true, titleIt: true } },
      },
    }),
  ]);
  const jobLines = jobs.map((job) => `${textOf(job.title, job.titleDe, job.titleIt, locale)} ${job.workType} ${job.location} clicks:${job.clickCount} applications:${job._count.applications}`).join("\n") || "(no active jobs)";
  const applicationLines = applications.map((row) => {
    const score = row.aiScore == null ? "" : ` score:${row.aiScore}${row.aiRecommendation ? ` ${row.aiRecommendation}` : ""}`;
    return `${row.firstName} ${row.lastName} stage:${row.stage}${score} job:${textOf(row.job.title, row.job.titleDe, row.job.titleIt, locale)}`;
  }).join("\n") || "(no applications)";
  return `RECRUITING\nActive jobs:\n${jobLines}\nRecent applications (name, stage, score — no CV text):\n${applicationLines}`.slice(0, 2500);
}

async function housekeepingPack(hotelTenantId: string, locale: ChatLocale) {
  const today = localTodayIso();
  const horizon = addDaysIso(today, 2);
  const todayDate = parseIsoDate(today);
  const horizonDate = parseIsoDate(horizon);
  const [rooms, assignments, completions, stays] = await Promise.all([
    prisma.room.findMany({
      where: { hotelTenantId, isActive: true, archivedAt: null },
      take: 120,
      orderBy: { number: "asc" },
      select: {
        id: true, number: true, nameEn: true, nameDe: true, nameIt: true,
        floor: { select: { nameEn: true, nameDe: true, nameIt: true } },
        category: { select: { nameEn: true, nameDe: true, nameIt: true } },
        roomOperationalStateRecords: {
          take: 1,
          select: { cleanliness: true, breakfastInRoom: true, doNotDisturb: true, noService: true, isExpress: true, linenChange: true },
        },
        checklistTemplate: {
          select: {
            roomChecksEn: true, roomChecksDe: true, roomChecksIt: true,
            arrivalChecksEn: true, arrivalChecksDe: true, arrivalChecksIt: true,
          },
        },
      },
    }),
    prisma.housekeepingRoomAssignment.findMany({
      where: { hotelTenantId, workDate: todayDate },
      take: 120,
      select: {
        roomId: true, cleaningType: true, plannedMinutes: true, completedAt: true,
        room: { select: { number: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.housekeepingChecklistCompletion.findMany({
      where: { hotelTenantId, workDate: todayDate },
      take: 800,
      select: { roomId: true, checklistType: true },
    }),
    prisma.reservationRoomStay.findMany({
      where: {
        hotelTenantId,
        arrivalDate: { lte: horizonDate },
        departureDate: { gte: todayDate },
        reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      },
      take: 80,
      orderBy: [{ arrivalDate: "asc" }],
      select: {
        roomId: true, arrivalDate: true, departureDate: true, adultCount: true, childCount: true,
        room: { select: { number: true } },
        reservation: { select: { status: true, board: true } },
        reservationGuestRecords: { take: 6, select: { name: true, vip: true } },
      },
    }),
  ]);
  const done = new Map<string, { room: number; arrival: number }>();
  for (const row of completions) {
    const current = done.get(row.roomId) || { room: 0, arrival: 0 };
    if (row.checklistType === "ARRIVAL") current.arrival += 1;
    else current.room += 1;
    done.set(row.roomId, current);
  }
  const busyRooms = new Set([...assignments.map((row) => row.roomId), ...stays.map((row) => row.roomId)]);
  const roomLines = rooms.map((room) => {
    const state = room.roomOperationalStateRecords[0];
    const flags = [
      state?.isExpress ? "express" : "",
      state?.doNotDisturb ? "dnd" : "",
      state?.noService ? "no-service" : "",
      state?.linenChange ? "linen" : "",
      state?.breakfastInRoom ? "breakfast-in-room" : "",
    ].filter(Boolean).join(",");
    const name = textOf(room.nameEn, room.nameDe, room.nameIt, locale);
    const floor = room.floor ? textOf(room.floor.nameEn, room.floor.nameDe, room.floor.nameIt, locale) : "";
    const category = room.category ? textOf(room.category.nameEn, room.category.nameDe, room.category.nameIt, locale) : "";
    return `${room.number}${name ? ` ${name}` : ""} floor:${floor || "-"} category:${category || "-"} ${state?.cleanliness || "UNKNOWN"}${flags ? ` ${flags}` : ""}`;
  }).join("\n") || "(no rooms)";
  const assignmentLines = assignments.map((row) => {
    const who = personName(row.assignedTo) || "unassigned";
    return `${row.room.number} ${row.cleaningType} ${row.plannedMinutes}m ${row.completedAt ? "done" : "open"} ${who}`;
  }).join("\n") || "(no assignments today)";
  const stayLines = stays.map((stay) => {
    const arrival = isoFromUtc(stay.arrivalDate);
    const departure = isoFromUtc(stay.departureDate);
    const label = arrival === today ? "ARRIVAL" : departure === today ? "DEPARTURE" : arrival <= today && departure > today ? "IN_HOUSE" : "UPCOMING";
    const guests = stay.reservationGuestRecords.map((guest) => `${guest.name}${guest.vip ? " VIP" : ""}`).join(", ");
    return `${stay.room.number} ${label} ${arrival}→${departure} ${stay.reservation.status} board:${stay.reservation.board || "-"} adults:${stay.adultCount ?? "-"} children:${stay.childCount ?? "-"} guests:${guests || "-"}`;
  }).join("\n") || "(no stays in this window)";
  const checklistLines = rooms.filter((room) => busyRooms.has(room.id) && room.checklistTemplate).map((room) => {
    const template = room.checklistTemplate;
    const roomChecks = checkItems(locale === "de" ? template?.roomChecksDe : locale === "it" ? template?.roomChecksIt : template?.roomChecksEn);
    const arrivalChecks = checkItems(locale === "de" ? template?.arrivalChecksDe : locale === "it" ? template?.arrivalChecksIt : template?.arrivalChecksEn);
    const progress = done.get(room.id) || { room: 0, arrival: 0 };
    return `${room.number} room checks (${progress.room}/${roomChecks.length} done today): ${roomChecks.slice(0, 4).join(" | ") || "-"}; arrival checks (${progress.arrival}/${arrivalChecks.length}): ${arrivalChecks.slice(0, 4).join(" | ") || "-"}`;
  }).join("\n") || "(no checklist templates for today's rooms)";
  return [
    `HOUSEKEEPING today ${today}, stays through ${horizon}. Cancelled and no-show stays are omitted.`,
    `Rooms:\n${roomLines}`,
    `Today's cleaning assignments:\n${assignmentLines}`,
    `Reservations overlapping today through ${horizon}:\n${stayLines}`,
    `Room checklists for assigned or occupied rooms:\n${checklistLines}`,
  ].join("\n\n").slice(0, 7000);
}

async function repairsPack(locale: ChatLocale) {
  const actor = await repairsViewer();
  if (!actor?.canManage) return null;
  const rows = await prisma.repair.findMany({
    where: { ...visibleWhere(actor, "REPAIR"), status: { not: "ERLEDIGT" } },
    take: 40,
    orderBy: { createdAt: "desc" },
    select: { status: true, title: true, titleDe: true, titleIt: true, location: true, locationDe: true, locationIt: true, description: true, descriptionDe: true, descriptionIt: true },
  });
  const lines = rows.map((row) => {
    const description = textOf(row.description, row.descriptionDe, row.descriptionIt, locale).replace(/\s+/g, " ").slice(0, 160);
    return `${row.status} ${textOf(row.title, row.titleDe, row.titleIt, locale)} @ ${textOf(row.location, row.locationDe, row.locationIt, locale)}${description ? ` — ${description}` : ""}`;
  }).join("\n") || "(no open repairs)";
  return `REPAIRS (open tickets only)\n${lines}`.slice(0, 2500);
}

async function tasksPack(locale: ChatLocale) {
  const actor = await tasksViewer();
  if (!actor?.canManage) return null;
  const [tasks, checklists] = await Promise.all([
    prisma.hotelTask.findMany({
      where: { ...visibleTaskWhere(actor), status: "OPEN" },
      take: 40,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      select: {
        title: true, titleDe: true, titleIt: true, dueAt: true,
        assignee: { select: { firstName: true, lastName: true } },
        department: { select: { nameEn: true, nameDe: true, nameIt: true } },
      },
    }),
    prisma.hotelChecklist.findMany({
      where: { ...visibleChecklistWhere(actor), kind: "CHECKLIST", status: "ACTIVE" },
      take: 20,
      orderBy: [{ dueAt: "asc" }],
      select: {
        title: true, titleDe: true, titleIt: true, dueAt: true, origin: true,
        items: { orderBy: { sortOrder: "asc" }, take: 12, select: { text: true, textDe: true, textIt: true, state: true } },
      },
    }),
  ]);
  const taskLines = tasks.map((row) => {
    const who = personName(row.assignee) || (row.department ? textOf(row.department.nameEn, row.department.nameDe, row.department.nameIt, locale) : "unassigned");
    return `${textOf(row.title, row.titleDe, row.titleIt, locale)} due:${row.dueAt ? isoFromUtc(row.dueAt) : "-"} ${who}`;
  }).join("\n") || "(no open tasks)";
  const checklistLines = checklists.map((row) => {
    const items = row.items.map((item) => `${item.state}:${textOf(item.text, item.textDe, item.textIt, locale)}`).join(" | ");
    return `${textOf(row.title, row.titleDe, row.titleIt, locale)} ${row.origin} due:${row.dueAt ? isoFromUtc(row.dueAt) : "-"} ${items}`;
  }).join("\n") || "(no active checklists)";
  return `TASKS AND CHECKLISTS\nOpen tasks:\n${taskLines}\nActive checklists:\n${checklistLines}`.slice(0, 2500);
}

async function operationalPack(question: string, locale: ChatLocale) {
  const user = await currentAccessUser();
  if (!user) return null;
  const [scheduleActor, manualsActor, recruiting, housekeeping, repairs, tasks] = await Promise.all([
    scheduleViewer(),
    manualsViewer(),
    recruitingActor(),
    housekeepingAccess(user),
    repairsPack(locale),
    tasksPack(locale),
  ]);
  const [schedule, manuals, recruitingText, housekeepingText] = await Promise.all([
    scheduleActor?.canManage ? scheduleContextPack(locale) : Promise.resolve(null),
    manualsActor?.canManage ? manualContextPack(manualsActor, question) : Promise.resolve(null),
    recruiting ? recruitingPack(user.hotel_tenant_id, locale) : Promise.resolve(null),
    housekeeping.board ? housekeepingPack(user.hotel_tenant_id, locale) : Promise.resolve(null),
  ]);
  return {
    hotelTenantId: user.hotel_tenant_id,
    pack: [
      "PACK TYPE: hotel facts the signed-in user may see. Sections marked unavailable were not permitted. Do not invent rooms, guests, shifts, tickets, or handbook steps.",
      `Today: ${localTodayIso()}`,
      schedule ? `SCHEDULE\n${schedule.slice(0, 4500)}` : "SCHEDULE: unavailable for this user.",
      manuals ? `MANUALS\n${manuals.slice(0, 3500)}` : "MANUALS: unavailable for this user.",
      recruitingText || "RECRUITING: unavailable for this user.",
      housekeepingText || "HOUSEKEEPING: unavailable for this user.",
      repairs || "REPAIRS: unavailable for this user.",
      tasks || "TASKS AND CHECKLISTS: unavailable for this user.",
    ].join("\n\n"),
  };
}

export async function answerGeneralQuestion(question: string, history: ChatTurn[], locale?: unknown) {
  const query = question.trim().slice(0, 2000);
  if (!query) return { error: "EMPTY" as const };
  const chatLocale = parseLocale(locale);
  const language = LANGUAGE[chatLocale];
  const packed = await operationalPack(query, chatLocale);
  if (!packed) return { error: "UNAUTHENTICATED" as const };
  const prior = history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));
  try {
    const answer = await completeHotelChat(prisma, packed.hotelTenantId, [
      {
        role: "system",
        content: `${language.rule} Never switch language. You are the hotel general assistant. Answer only from the operational pack: roster, handbook excerpts, recruiting summary, housekeeping rooms, reservations, room checklists, repairs, and tasks. If a section says unavailable, say you cannot see that area. If a fact is missing, say you do not know. Do not claim you changed any record.`,
      },
      ...prior,
      { role: "user", content: `App language: ${language.name}. Reply only in ${language.name}.\n\nQuestion:\n${query}\n\nOperational pack:\n${packed.pack}` },
    ]);
    if (answer) return { answer };
    return {
      answer: chatLocale === "de"
        ? "Die KI-Antwort ist gerade nicht verfügbar. Ich erfinde keine Hoteldaten."
        : chatLocale === "it"
          ? "La risposta IA non è disponibile. Non invento i dati dell’hotel."
          : "The language model is unavailable. I will not invent hotel facts.",
    };
  } catch (error) {
    if (error instanceof HotelAiNotConfiguredError) {
      return {
        answer: chatLocale === "de"
          ? "Hinterlege in den Einstellungen einen KI-Schlüssel, damit der Assistent antworten kann."
          : chatLocale === "it"
            ? "In Impostazioni aggiungi una chiave IA perché l’assistente possa rispondere."
            : "Add an AI key in Settings so the assistant can answer.",
      };
    }
    return { error: "MODEL_FAILED" as const };
  }
}
