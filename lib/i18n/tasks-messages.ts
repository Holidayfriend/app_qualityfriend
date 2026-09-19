import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const tasksMessages = {
  en: en.tasksMessages,
  de: de.tasksMessages,
  it: it.tasksMessages,
} as const;

export type TasksMessages = typeof tasksMessages.en;

export function getTasksMessages(locale: keyof typeof tasksMessages) {
  return tasksMessages[locale] ?? tasksMessages.en;
}
