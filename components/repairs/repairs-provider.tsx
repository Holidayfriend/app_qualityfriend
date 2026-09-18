"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";

export type HotelDept = { id: string; name: string };
export type HotelUser = { id: string; name: string };
export type HotelRoom = { id: string; number: string };
export type PublicRepair = {
  id: string;
  kind?: string;
  title: string;
  location: string;
  locationKey: string;
  desc: string;
  tags: string[];
  creator: string;
  date: string;
  status: string;
  assignee: string;
  assigneeId: string;
  visibility: "alle" | "dept";
  depts: string[];
  comments: { text: string; author: string; date: string }[];
  origLang?: string;
};

type Ctx = {
  repairs: PublicRepair[];
  templates: PublicRepair[];
  rooms: HotelRoom[];
  departments: HotelDept[];
  users: HotelUser[];
  canManage: boolean;
  ready: boolean;
  avgResponseDays: number | null;
  reload: () => Promise<void>;
};

const RepairsContext = createContext<Ctx | null>(null);

export function RepairsProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [repairs, setRepairs] = useState<PublicRepair[]>([]);
  const [templates, setTemplates] = useState<PublicRepair[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [departments, setDepartments] = useState<HotelDept[]>([]);
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [ready, setReady] = useState(false);
  const [avgResponseDays, setAvgResponseDays] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const [listRes, tplRes, locRes] = await Promise.all([
      fetch(`/api/repairs?locale=${locale}`, { cache: "no-store" }),
      fetch(`/api/repairs?locale=${locale}&kind=template`, { cache: "no-store" }),
      fetch(`/api/repairs/locations?locale=${locale}`, { cache: "no-store" }),
    ]);
    const list = listRes.ok ? await listRes.json() as { repairs?: PublicRepair[]; canManage?: boolean; avgResponseDays?: number | null } : null;
    const tpls = tplRes.ok ? await tplRes.json() as { repairs?: PublicRepair[] } : null;
    const loc = locRes.ok ? await locRes.json() as { rooms?: HotelRoom[]; departments?: HotelDept[]; users?: HotelUser[] } : null;
    setRepairs(Array.isArray(list?.repairs) ? list.repairs : []);
    setTemplates(Array.isArray(tpls?.repairs) ? tpls.repairs : []);
    setRooms(Array.isArray(loc?.rooms) ? loc.rooms : []);
    setDepartments(Array.isArray(loc?.departments) ? loc.departments : []);
    setUsers(Array.isArray(loc?.users) ? loc.users : []);
    setCanManage(Boolean(list?.canManage));
    setAvgResponseDays(typeof list?.avgResponseDays === "number" ? list.avgResponseDays : null);
    setReady(true);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("qf-shell-refresh"));
  }, [locale]);

  useEffect(() => { void reload(); }, [reload]);

  const value = useMemo<Ctx>(() => ({ repairs, templates, rooms, departments, users, canManage, ready, avgResponseDays, reload }), [avgResponseDays, canManage, departments, ready, reload, repairs, rooms, templates, users]);
  return <RepairsContext.Provider value={value}>{children}</RepairsContext.Provider>;
}

export function useRepairs() {
  const ctx = useContext(RepairsContext);
  if (!ctx) throw new Error("useRepairs");
  return ctx;
}
