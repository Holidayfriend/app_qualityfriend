"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";

export type HotelDept = { id: string; name: string };
export type PublicHandover = {
  id: string;
  kind?: string;
  title: string;
  desc: string;
  tags: string[];
  creator: string;
  creatorId?: string;
  date: string;
  status: string;
  pinned: boolean;
  completedAt?: string;
  completedBy?: string;
  visibility: "alle" | "dept" | "privat";
  depts: string[];
};

type Ctx = {
  handovers: PublicHandover[];
  templates: PublicHandover[];
  departments: HotelDept[];
  canManage: boolean;
  ready: boolean;
  reload: () => Promise<void>;
};

const HandoversContext = createContext<Ctx | null>(null);

export function HandoversProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [handovers, setHandovers] = useState<PublicHandover[]>([]);
  const [templates, setTemplates] = useState<PublicHandover[]>([]);
  const [departments, setDepartments] = useState<HotelDept[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const [listRes, tplRes, locRes, meRes] = await Promise.all([
      fetch(`/api/handovers?locale=${locale}`, { cache: "no-store" }),
      fetch(`/api/handovers?locale=${locale}&kind=template`, { cache: "no-store" }),
      fetch(`/api/handovers/locations?locale=${locale}`, { cache: "no-store" }),
      fetch("/api/me", { cache: "no-store" }),
    ]);
    const list = listRes.ok ? await listRes.json() as { handovers?: PublicHandover[]; canManage?: boolean } : null;
    const tpls = tplRes.ok ? await tplRes.json() as { handovers?: PublicHandover[] } : null;
    const loc = locRes.ok ? await locRes.json() as { departments?: HotelDept[] } : null;
    const me = meRes.ok ? await meRes.json() as { role?: string; allowed_modules?: string[] } : null;
    setHandovers(Array.isArray(list?.handovers) ? list.handovers : []);
    setTemplates(Array.isArray(tpls?.handovers) ? tpls.handovers : []);
    setDepartments(Array.isArray(loc?.departments) ? loc.departments : []);
    setCanManage(Boolean(list?.canManage) || me?.role === "ADMIN" || Boolean(me?.allowed_modules?.includes("handovers")));
    setReady(true);
  }, [locale]);

  useEffect(() => { void reload(); }, [reload]);

  const value = useMemo<Ctx>(() => ({ handovers, templates, departments, canManage, ready, reload }), [canManage, departments, handovers, ready, reload, templates]);
  return <HandoversContext.Provider value={value}>{children}</HandoversContext.Provider>;
}

export function useHandovers() {
  const ctx = useContext(HandoversContext);
  if (!ctx) throw new Error("useHandovers");
  return ctx;
}
