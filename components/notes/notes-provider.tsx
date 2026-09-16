"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import { INITIAL_NOTES, type Note, type NoteComment, type NoteDept, type NoteFile, type NoteStatus, type NoteVisibility } from "../../lib/notes/demo-data";

export type HotelDept = { id: string; name: string };
export type HotelUser = { id: string; name: string };

type Store = {
  fullName: string;
  notes: Note[];
  departments: HotelDept[];
  users: HotelUser[];
  upsert: (note: Note) => void;
  toggleStatus: (id: string) => void;
  addComment: (id: string, text: string) => void;
};

const NotesContext = createContext<Store | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [fullName, setFullName] = useState("Klaus");
  const [departments, setDepartments] = useState<HotelDept[]>([]);
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [notes, setNotes] = useState<Note[]>(() => INITIAL_NOTES.map((item) => ({ ...item, depts: [...item.depts], userIds: [...item.userIds], tags: [...item.tags], attachments: [...item.attachments], comments: [...item.comments] })));

  useEffect(() => {
    fetch("/api/me").then(async (response) => {
      if (!response.ok) return;
      const user = await response.json() as { first_name: string; last_name: string };
      setFullName(`${user.first_name} ${user.last_name}`.trim() || "Klaus");
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch(`/api/notes/departments?locale=${locale}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (Array.isArray(data?.departments)) setDepartments(data.departments); })
      .catch(() => undefined);
  }, [locale]);

  useEffect(() => {
    fetch("/api/notes/users")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (Array.isArray(data?.users)) setUsers(data.users); })
      .catch(() => undefined);
  }, []);

  function upsert(note: Note) {
    setNotes((current) => {
      const index = current.findIndex((item) => item.id === note.id);
      if (index < 0) return [note, ...current];
      return current.map((item) => item.id === note.id ? note : item);
    });
  }

  function toggleStatus(id: string) {
    setNotes((current) => current.map((item) => item.id === id ? { ...item, status: (item.status === "aktiv" ? "inaktiv" : "aktiv") as NoteStatus } : item));
  }

  function addComment(id: string, text: string) {
    const comment: NoteComment = { text, author: fullName.split(" ")[0] || "Klaus", date: new Date().toLocaleDateString("de-DE") };
    setNotes((current) => current.map((item) => item.id === id ? { ...item, comments: [...item.comments, comment] } : item));
  }

  const value = useMemo(() => ({ fullName, notes, departments, users, upsert, toggleStatus, addComment }), [fullName, notes, departments, users]);
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) throw new Error("useNotes must be used inside NotesProvider");
  return context;
}

export type { Note, NoteDept, NoteFile, NoteVisibility };
