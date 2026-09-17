import en from "./locales/en.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const manualsMessages = {
  en: en.manualsMessages,
  de: de.manualsMessages,
  it: it.manualsMessages,
} as const;

export type ManualsMessages = typeof manualsMessages.en;

export function getManualsMessages(locale: keyof typeof manualsMessages) {
  return manualsMessages[locale] ?? manualsMessages.en;
}
