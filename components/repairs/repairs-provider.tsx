"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import { seedRepairs, type Repair, type RepairComment, type RepairFile, type RepairStatus } from "../../lib/repairs/demo-data";

const STORAGE = "qf-repairs-demo";

export type HotelDept = { id: string; name: string };
export type HotelUser = { id: string; name: string };
export type HotelRoom = { id: string; number: string };

type Ctx = {
  repairs: Repair[];
  rooms: HotelRoom[];
  departments: HotelDept[];
  users: HotelUser[];
  ready: boolean;
  upsert: (repair: Repair) => void;
  setStatus: (id: string, status: RepairStatus) => void;
  setAssignee: (id: string, assignee: string) => void;
  addComment: (id: string, comment: RepairComment) => void;
};

const RepairsContext = createContext<Ctx | null>(null);

function withLocation(row: Repair, fallback = ""): Repair {
  return { ...row, location: row.location || fallback };
}

function load(): Repair[] {
  if (typeof window === "undefined") return seedRepairs;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return seedRepairs;
    const parsed = JSON.parse(raw) as Repair[];
    if (!Array.isArray(parsed) || !parsed.length) return seedRepairs;
    const seedById = new Map(seedRepairs.map((item) => [item.id, item]));
    return parsed.map((row) => withLocation(row, seedById.get(row.id)?.location ?? ""));
  } catch {
    return seedRepairs;
  }
}

export function RepairsProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [repairs, setRepairs] = useState<Repair[]>(seedRepairs);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [departments, setDepartments] = useState<HotelDept[]>([]);
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRepairs(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE, JSON.stringify(repairs));
  }, [ready, repairs]);

  useEffect(() => {
    let active = true;
    fetch(`/api/repairs/locations?locale=${locale}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!active || !response.ok) return;
      setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      setDepartments(Array.isArray(data?.departments) ? data.departments : []);
      setUsers(Array.isArray(data?.users) ? data.users : []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [locale]);

  const value = useMemo<Ctx>(() => ({
    repairs,
    rooms,
    departments,
    users,
    ready,
    upsert: (repair) => setRepairs((list) => {
      const index = list.findIndex((item) => item.id === repair.id);
      if (index < 0) return [repair, ...list];
      return list.map((item) => item.id === repair.id ? repair : item);
    }),
    setStatus: (id, status) => setRepairs((list) => list.map((item) => item.id === id ? { ...item, status } : item)),
    setAssignee: (id, assignee) => setRepairs((list) => list.map((item) => {
      if (item.id !== id) return item;
      const next: Repair = { ...item, assignee };
      if (item.status === "neu" && assignee) next.status = "uebernommen";
      return next;
    })),
    addComment: (id, comment) => setRepairs((list) => list.map((item) => item.id === id ? { ...item, comments: [...item.comments, comment] } : item)),
  }), [departments, ready, repairs, rooms, users]);

  return <RepairsContext.Provider value={value}>{children}</RepairsContext.Provider>;
}

export function useRepairs() {
  const ctx = useContext(RepairsContext);
  if (!ctx) throw new Error("useRepairs");
  return ctx;
}

export type { RepairFile };
