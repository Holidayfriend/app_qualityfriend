import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const scheduleMessages = {
  en: en.scheduleMessages,
  de: de.scheduleMessages,
  it: it.scheduleMessages,
} as const;

export type ScheduleMessages = typeof scheduleMessages.en;

export function getScheduleMessages(locale: keyof typeof scheduleMessages) {
  return scheduleMessages[locale] ?? scheduleMessages.en;
}
