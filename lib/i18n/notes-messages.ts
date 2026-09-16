import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const notesMessages = {
  en: en.notesMessages,
  de: de.notesMessages,
  it: it.notesMessages,
} as const;

export type NotesMessages = typeof notesMessages.en;

export function getNotesMessages(locale: keyof typeof notesMessages) {
  return notesMessages[locale] ?? notesMessages.en;
}
