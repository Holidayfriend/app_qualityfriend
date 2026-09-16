"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import type { Note } from "../../lib/notes/demo-data";

export type HotelDept = { id: string; name: string };
export type HotelUser = { id: string; name: string };

type Store = {
  notes: Note[];
  templates: Note[];
  departments: HotelDept[];
  users: HotelUser[];
  loading: boolean;
  reload: () => Promise<void>;
};

const NotesContext = createContext<Store | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [notes, setNotes] = useState<Note[]>([]);
  const [templates, setTemplates] = useState<Note[]>([]);
  const [departments, setDepartments] = useState<HotelDept[]>([]);
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, templatesRes, departmentsRes, usersRes] = await Promise.all([
        fetch(`/api/notes?locale=${locale}`, { cache: "no-store" }),
        fetch(`/api/notes?locale=${locale}&kind=template`, { cache: "no-store" }),
        fetch(`/api/notes/departments?locale=${locale}`, { cache: "no-store" }),
        fetch("/api/notes/users", { cache: "no-store" }),
      ]);
      const notesData = notesRes.ok ? await notesRes.json() as { notes?: Note[] } : null;
      const templatesData = templatesRes.ok ? await templatesRes.json() as { notes?: Note[] } : null;
      const departmentsData = departmentsRes.ok ? await departmentsRes.json() as { departments?: HotelDept[] } : null;
      const usersData = usersRes.ok ? await usersRes.json() as { users?: HotelUser[] } : null;
      setNotes(Array.isArray(notesData?.notes) ? notesData.notes : []);
      setTemplates(Array.isArray(templatesData?.notes) ? templatesData.notes : []);
      setDepartments(Array.isArray(departmentsData?.departments) ? departmentsData.departments : []);
      setUsers(Array.isArray(usersData?.users) ? usersData.users : []);
    } catch {
      setNotes([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void reload(); }, [reload]);

  const value = useMemo(() => ({ notes, templates, departments, users, loading, reload }), [notes, templates, departments, users, loading, reload]);
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) throw new Error("useNotes must be used inside NotesProvider");
  return context;
}
