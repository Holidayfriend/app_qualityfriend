export type NoteDept = string;
export type NoteVisibility = "alle" | "dept" | "user" | "privat";
export type NoteStatus = "aktiv" | "inaktiv";
export type NoteComment = { id?: string; text: string; author: string; date: string };
export type NoteFile = { id?: string; name: string; url?: string };
export type Note = {
  id: string;
  createdById?: string;
  kind?: "note" | "template";
  title: string;
  creator: string;
  date: string;
  status: NoteStatus;
  visibility: NoteVisibility;
  depts: NoteDept[];
  userIds: string[];
  tags: string[];
  origLang: string;
  desc: string;
  attachments: NoteFile[];
  comments: NoteComment[];
};

export const NOTE_COLORS: Record<string, string> = {
  alle: "#FEF9E7",
  privat: "#F3F4F6",
  user: "#E0F2FE",
  dept: "#DBEAFE",
};

export function noteColorFor(note: Note) {
  if (note.visibility === "dept") return NOTE_COLORS.dept;
  if (note.visibility === "user") return NOTE_COLORS.user;
  if (note.visibility === "privat") return NOTE_COLORS.privat;
  return NOTE_COLORS.alle;
}
