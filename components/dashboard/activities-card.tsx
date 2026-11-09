"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hotelLocalIso, readHotelTimeZone } from "../../lib/hotel/clock";
import type { PublicChecklist, PublicTask } from "../../lib/tasks/demo-data";
import { useI18n } from "../i18n/i18n-provider";

type Row = {
  key: string;
  href: string;
  icon: string;
  tone: "r" | "a" | "b";
  title: string;
  meta: string;
  status: string;
  statusClass: "sc-r" | "sc-a";
  when: string;
};

function roomList(rooms: string[]) {
  if (rooms.length <= 2) return rooms.join(" & ");
  return `${rooms.slice(0, -1).join(", ")} & ${rooms[rooms.length - 1]}`;
}

function checklistOpen(item: PublicChecklist) {
  if (item.completedAt) return false;
  if (!item.items.length) return true;
  return item.items.some((row) => row.state === "open");
}

export function ActivitiesCard() {
  const router = useRouter();
  const { dictionary, locale } = useI18n();
  const d = dictionary.dashboard;
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = hotelLocalIso(readHotelTimeZone());
    Promise.all([
      fetch("/api/dashboard/housekeeping", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)),
      fetch(`/api/tasks?locale=${locale}`, { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)),
      fetch(`/api/checklists?locale=${locale}`, { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)),
    ]).then(([housekeeping, tasksPayload, checklistsPayload]) => {
      if (cancelled) return;
      const expressRooms = Array.isArray(housekeeping?.expressRooms) ? housekeeping.expressRooms.filter((room: unknown): room is string => typeof room === "string" && room.trim() !== "") : [];
      const tasks = Array.isArray(tasksPayload?.tasks) ? tasksPayload.tasks as PublicTask[] : [];
      const checklists = Array.isArray(checklistsPayload?.checklists) ? checklistsPayload.checklists as PublicChecklist[] : [];
      const dueTasks = tasks
        .filter((item) => item.status === "open" && item.dueIso && item.dueIso <= today)
        .sort((left, right) => left.dueIso.localeCompare(right.dueIso) || left.title.localeCompare(right.title));
      const dueChecklists = checklists.filter((item) => item.kind === "checklist" && item.status === "active" && item.nextDueIso && item.nextDueIso <= today && checklistOpen(item));
      const runOriginals = new Set(dueChecklists.filter((item) => item.origin === "run" && item.originalId).map((item) => item.originalId));
      const visibleChecklists = dueChecklists
        .filter((item) => item.origin === "run" || !runOriginals.has(item.id))
        .sort((left, right) => left.nextDueIso.localeCompare(right.nextDueIso) || left.title.localeCompare(right.title));
      const next: Row[] = [];
      if (expressRooms.length) {
        next.push({
          key: "express",
          href: "/housekeeping",
          icon: "⚡",
          tone: "r",
          title: (expressRooms.length === 1 ? d.expressCleaningOne : d.expressCleaning).replace("{rooms}", roomList(expressRooms)),
          meta: dictionary.navigation.housekeeping,
          status: d.urgentStatus,
          statusClass: "sc-r",
          when: d.now,
        });
      }
      for (const item of dueTasks) {
        const overdue = item.dueIso < today;
        next.push({
          key: `task-${item.id}`,
          href: `/tasks/${item.id}`,
          icon: "✅",
          tone: overdue ? "r" : "a",
          title: item.title,
          meta: item.assignee || d.activities,
          status: overdue ? d.urgentStatus : d.openStatus,
          statusClass: overdue ? "sc-r" : "sc-a",
          when: overdue ? item.due : d.now,
        });
      }
      for (const item of visibleChecklists) {
        const overdue = item.nextDueIso < today;
        next.push({
          key: `checklist-${item.id}`,
          href: `/tasks/checklists/${item.id}`,
          icon: "📋",
          tone: overdue ? "r" : "b",
          title: item.title,
          meta: [d.checklistActivity, item.progress, item.assignee].filter(Boolean).join(" · "),
          status: overdue ? d.urgentStatus : d.openStatus,
          statusClass: overdue ? "sc-r" : "sc-a",
          when: item.dueTime || (overdue ? item.nextDue : d.now),
        });
      }
      setRows(next);
    }).catch(() => {
      if (!cancelled) setRows([]);
    }).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [d.activities, d.checklistActivity, d.expressCleaning, d.expressCleaningOne, d.now, d.openStatus, d.urgentStatus, dictionary.navigation.housekeeping, locale]);

  return (
    <div className="card">
      <div className="ch"><div className="ct">🔔 {d.activities}</div><span className="ca" onClick={() => router.push("/tasks")}>{d.allTasks} →</span></div>
      <div className="cb">
        {loaded && rows.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{d.activitiesEmpty}</div> : null}
        {rows.map((row) => (
          <Link key={row.key} href={row.href} className="al" style={{ textDecoration: "none", color: "inherit" }}>
            <div className={`al-ic ${row.tone}`}>{row.icon}</div>
            <div>
              <div className="al-t">{row.title}</div>
              <div className="al-m">{row.meta}</div>
            </div>
            <div className="al-r"><span className={`sc ${row.statusClass}`}>{row.status}</span><div className="tl">{row.when}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
